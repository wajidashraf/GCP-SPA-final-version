import { useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import {
  CalendarPlus,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DateTimeField, SelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import { slotDurationChoices, SLOT_STATUS_AVAILABLE } from '../../data/slotChoices';
import { createSlot } from '../../shared/services/slotService';

/** A contact that can be picked as a slot attendee. */
export type AttendeeOption = {
  contactId: string;
  name: string;
};

type CreateSlotModalProps = {
  show: boolean;
  onHide: () => void;
  /** Called after a slot is created successfully (so the list can refresh). */
  onCreated: () => void;
  /** Contacts selectable as attendees. Currently just the logged-in user. */
  contacts: AttendeeOption[];
};

const MAX_ATTENDEES = 3;
const DEFAULT_DURATION = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as a local `YYYY-MM-DDTHH:mm` string for datetime-local inputs. */
const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;

/** Add `minutes` to a local datetime-local string, returning the same format. */
const addMinutes = (local: string, minutes: number): string => {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInput(d);
};

/** Convert a local datetime-local string to an ISO UTC string for Dataverse. */
const localToIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const CreateSlotModal = ({
  show,
  onHide,
  onCreated,
  contacts,
}: CreateSlotModalProps) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [attendees, setAttendees] = useState<string[]>(() =>
    contacts[0] ? [contacts[0].contactId] : ['']
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const end = useMemo(() => addMinutes(start, duration), [start, duration]);

  const canAddAttendee =
    attendees.length < MAX_ATTENDEES &&
    attendees.length < contacts.length &&
    attendees.every(Boolean);

  const titleError = touched && !title.trim() ? 'A title is required.' : undefined;
  const startError = touched && !start ? 'A start date and time is required.' : undefined;
  const attendeeError =
    touched && !attendees.some(Boolean) ? 'Select at least one attendee.' : undefined;

  const reset = () => {
    setTitle('');
    setStart('');
    setDuration(DEFAULT_DURATION);
    setAttendees(contacts[0] ? [contacts[0].contactId] : ['']);
    setError(null);
    setTouched(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onHide();
  };

  const setAttendeeAt = (index: number, value: string) =>
    setAttendees((prev) => prev.map((a, i) => (i === index ? value : a)));

  const addAttendee = () => setAttendees((prev) => [...prev, '']);

  const removeAttendee = (index: number) =>
    setAttendees((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setTouched(true);
    const selected = attendees.filter(Boolean);
    if (!title.trim() || !start || selected.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await createSlot(
        {
          gcp_type: title.trim(),
          gcp_slotstatus: SLOT_STATUS_AVAILABLE,
          gcp_date: localToIso(start),
          gcp_start: localToIso(start),
          gcp_end: localToIso(end),
        },
        { attendeeIds: selected }
      );
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
      dialogClassName="slot-modal-dialog"
      aria-labelledby="create-slot-title"
    >
      <div className="slot-modal">
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <CalendarPlus size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="create-slot-title" className="slot-modal-title">
              Create new slot
            </h2>
            <p className="slot-modal-sub">
              Open a meeting or engagement slot for booking.
            </p>
          </div>
          <button
            type="button"
            className="slot-modal-close"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="slot-modal-body">
          {error && (
            <InlineMessage tone="error" title="Couldn’t create slot" className="mb-3">
              {error}
            </InlineMessage>
          )}

          {contacts.length === 0 && (
            <InlineMessage tone="warning" className="mb-3">
              Your contact record couldn’t be resolved, so no attendee can be
              selected yet. Try reloading once signed in.
            </InlineMessage>
          )}

          <TextField
            name="slotTitle"
            label="Title / type"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Vendor onboarding review"
            isRequired
            error={titleError}
          />

          <DateTimeField
            name="slotStart"
            label="Start date & time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            isRequired
            error={startError}
          />

          {/* Duration chips → auto-compute the end time */}
          <div className="slot-duration">
            <span className="slot-duration-label">
              <Clock size={14} aria-hidden="true" /> Duration
            </span>
            <div className="slot-chip-row" role="radiogroup" aria-label="Duration">
              {slotDurationChoices.map((opt) => {
                const active = duration === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`slot-chip${active ? ' slot-chip-active' : ''}`}
                    onClick={() => setDuration(opt.value)}
                  >
                    {opt.value} min
                  </button>
                );
              })}
            </div>
          </div>

          <div className="slot-endtime">
            <span className="slot-endtime-label">Ends at</span>
            <span className="slot-endtime-value">
              {end
                ? new Date(end).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Set a start time to calculate'}
            </span>
          </div>

          {/* Attendees */}
          <div className="slot-attendees">
            <div className="slot-attendees-head">
              <span className="slot-duration-label">
                <Users size={14} aria-hidden="true" /> Attendees
                <span className="slot-attendees-count">
                  {attendees.filter(Boolean).length}/{MAX_ATTENDEES}
                </span>
              </span>
            </div>

            {attendeeError && (
              <div className="slot-attendees-error">{attendeeError}</div>
            )}

            {attendees.map((value, index) => {
              // Options = contacts not chosen in other rows (+ this row's pick).
              const takenElsewhere = new Set(
                attendees.filter((_, i) => i !== index).filter(Boolean)
              );
              const options = contacts
                .filter((c) => !takenElsewhere.has(c.contactId))
                .map((c) => ({ label: c.name, value: c.contactId }));

              return (
                <div className="slot-attendee-row" key={index}>
                  <SelectField
                    name={`attendee-${index}`}
                    label={index === 0 ? 'Primary attendee' : `Attendee ${index + 1}`}
                    value={value}
                    onChange={(e) => setAttendeeAt(index, e.target.value)}
                    options={options}
                    placeholder="Select attendee"
                  />
                  {attendees.length > 1 && (
                    <button
                      type="button"
                      className="slot-attendee-remove"
                      onClick={() => removeAttendee(index)}
                      aria-label={`Remove attendee ${index + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="slot-add-attendee"
              onClick={addAttendee}
              disabled={!canAddAttendee}
            >
              <Plus size={15} aria-hidden="true" />
              Add attendee
            </button>
          </div>
        </div>

        <footer className="slot-modal-foot">
          <button
            type="button"
            className="slot-btn slot-btn-ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="slot-btn slot-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                Creating…
              </>
            ) : (
              <>
                <CalendarPlus size={16} aria-hidden="true" />
                Create slot
              </>
            )}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default CreateSlotModal;
export { CreateSlotModal };
