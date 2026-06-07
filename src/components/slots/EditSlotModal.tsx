import { useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import {
  Clock,
  Edit,
  Loader2,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DateTimeField, SelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import {
  slotDurationChoices,
  slotStatusChoices,
} from '../../data/slotChoices';
import { toSelectOptions } from '../../data/types';
import { updateSlot } from '../../shared/services/slotService';
import type { Slot } from '../../types/slot';
import type { AttendeeOption } from './CreateSlotModal';

type EditSlotModalProps = {
  show: boolean;
  slot: Slot | null;
  onHide: () => void;
  onSaved: () => void;
  contacts: AttendeeOption[];
};

const MAX_ATTENDEES = 3;

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const isoToLocal = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toLocalInput(d);
};

const addMinutes = (local: string, minutes: number): string => {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInput(d);
};

const localToIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const inferDuration = (startIso: string | null, endIso: string | null): number => {
  if (!startIso || !endIso) return 30;
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
  );
  const valid = slotDurationChoices.map((d) => d.value);
  return (valid as readonly number[]).includes(mins) ? mins : 30;
};

const EditSlotModal = ({ show, slot, onHide, onSaved, contacts }: EditSlotModalProps) => {
  const initialStart = slot ? isoToLocal(slot.start) : '';
  const initialDuration = slot ? inferDuration(slot.start, slot.end) : 30;

  // Merge existing slot attendees into the selectable options so they're always
  // visible even if not in the contacts prop.
  const mergedContacts = useMemo<AttendeeOption[]>(() => {
    if (!slot) return contacts;
    const seen = new Set(contacts.map((c) => c.contactId));
    const extras = slot.attendees
      .filter((a) => !seen.has(a.contactId))
      .map((a) => ({ contactId: a.contactId, name: a.name ?? a.contactId }));
    return [...contacts, ...extras];
  }, [contacts, slot]);

  const [title, setTitle] = useState(slot?.title ?? '');
  const [start, setStart] = useState(initialStart);
  const [duration, setDuration] = useState(initialDuration);
  const [status, setStatus] = useState(String(slot?.status ?? 2));
  const [attendees, setAttendees] = useState<(string | null)[]>(() => {
    if (!slot || slot.attendees.length === 0) return [''];
    // Up to 3 existing attendees; pad with nulls if fewer than currently shown
    return slot.attendees.slice(0, MAX_ATTENDEES).map((a) => a.contactId);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const end = useMemo(() => addMinutes(start, duration), [start, duration]);

  const canAddAttendee =
    attendees.length < MAX_ATTENDEES &&
    attendees.length < mergedContacts.length &&
    attendees.every(Boolean);

  const titleError = touched && !title.trim() ? 'A title is required.' : undefined;
  const startError = touched && !start ? 'A start date and time is required.' : undefined;

  const setAttendeeAt = (index: number, value: string) =>
    setAttendees((prev) => prev.map((a, i) => (i === index ? value || null : a)));

  const addAttendee = () => setAttendees((prev) => [...prev, null]);

  const removeAttendee = (index: number) =>
    setAttendees((prev) => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSave = async () => {
    setTouched(true);
    if (!title.trim() || !start) return;
    if (!slot) return;

    setSubmitting(true);
    setError(null);
    try {
      // Build the full attendee list for all three slots.
      // Index 0-2: pass the contactId or null to clear.
      const attendeeIds: (string | null)[] = [
        attendees[0] ?? null,
        attendees[1] ?? null,
        attendees[2] ?? null,
      ];

      await updateSlot(
        slot.id,
        {
          gcp_type: title.trim(),
          gcp_slotstatus: Number(status),
          gcp_date: localToIso(start),
          gcp_start: localToIso(start),
          gcp_end: localToIso(end),
        },
        { attendeeIds }
      );
      onSaved();
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
      aria-labelledby="edit-slot-title"
    >
      <div className="slot-modal">
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <Edit size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="edit-slot-title" className="slot-modal-title">
              Edit slot
            </h2>
            <p className="slot-modal-sub">Update the slot's details and attendees.</p>
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
            <InlineMessage tone="error" title="Couldn't save slot" className="mb-3">
              {error}
            </InlineMessage>
          )}

          <TextField
            name="editSlotTitle"
            label="Title / type"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Vendor onboarding review"
            isRequired
            error={titleError}
          />

          <SelectField
            name="editSlotStatus"
            label="Status"
            isRequired
            options={toSelectOptions(slotStatusChoices)}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />

          <DateTimeField
            name="editSlotStart"
            label="Start date & time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            isRequired
            error={startError}
          />

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

          <div className="slot-attendees">
            <div className="slot-attendees-head">
              <span className="slot-duration-label">
                <Users size={14} aria-hidden="true" /> Attendees
                <span className="slot-attendees-count">
                  {attendees.filter(Boolean).length}/{MAX_ATTENDEES}
                </span>
              </span>
            </div>

            {attendees.map((value, index) => {
              const takenElsewhere = new Set(
                attendees.filter((_, i) => i !== index).filter(Boolean)
              );
              const options = mergedContacts
                .filter((c) => !takenElsewhere.has(c.contactId))
                .map((c) => ({ label: c.name, value: c.contactId }));

              return (
                <div className="slot-attendee-row" key={index}>
                  <SelectField
                    name={`edit-attendee-${index}`}
                    label={index === 0 ? 'Primary attendee' : `Attendee ${index + 1}`}
                    value={value ?? ''}
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
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Edit size={16} aria-hidden="true" />
                Save changes
              </>
            )}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default EditSlotModal;
export { EditSlotModal };
