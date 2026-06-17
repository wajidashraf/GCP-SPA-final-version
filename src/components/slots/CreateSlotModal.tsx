import { useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { CalendarPlus, Clock, Loader2, X } from 'lucide-react';
import { DateTimeField, MultiSelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import { slotDurationChoices, SLOT_STATUS_AVAILABLE } from '../../data/slotChoices';
import { createSlot, MAX_ATTENDEES } from '../../shared/services/slotService';

/** A contact (Reviewer) that can be picked as a slot attendee. */
export type AttendeeOption = {
  contactId: string;
  name: string;
  email?: string | null;
};

type CreateSlotModalProps = {
  show: boolean;
  onHide: () => void;
  /** Called after a slot is created successfully (so the list can refresh). */
  onCreated: () => void;
  /** Reviewer-role contacts selectable as attendees. */
  contacts: AttendeeOption[];
};

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
  // Selected attendees, as contact GUIDs (max MAX_ATTENDEES).
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const end = useMemo(() => addMinutes(start, duration), [start, duration]);

  const attendeeOptions = useMemo(
    () => contacts.map((c) => ({ label: c.name, value: c.contactId })),
    [contacts]
  );

  const titleError = touched && !title.trim() ? 'A title is required.' : undefined;
  const startError = touched && !start ? 'A start date and time is required.' : undefined;
  const attendeeError =
    touched && attendees.length === 0 ? 'Select at least one reviewer.' : undefined;

  const reset = () => {
    setTitle('');
    setStart('');
    setDuration(DEFAULT_DURATION);
    setAttendees([]);
    setError(null);
    setTouched(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onHide();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!title.trim() || !start || attendees.length === 0) return;

    const byId = new Map(contacts.map((c) => [c.contactId, c]));
    const selected = attendees.map((id) => ({
      contactId: id,
      email: byId.get(id)?.email ?? null,
    }));

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
        { attendees: selected }
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

          {/* Attendees — Reviewer-role contacts (up to MAX_ATTENDEES) */}
          <div className="slot-attendees">
            <MultiSelectField
              name="attendees"
              label="Reviewers"
              value={attendees}
              onChange={setAttendees}
              options={attendeeOptions}
              maxSelected={MAX_ATTENDEES}
              placeholder="Select reviewers"
              emptyText="No reviewers available."
              isRequired
              error={attendeeError}
              helpText={`Select up to ${MAX_ATTENDEES} reviewers (${attendees.length}/${MAX_ATTENDEES}).`}
            />
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
