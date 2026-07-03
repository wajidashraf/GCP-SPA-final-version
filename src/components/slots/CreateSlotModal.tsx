import { useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { DateTimeField, MultiSelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import { SLOT_STATUS_AVAILABLE } from '../../data/slotChoices';
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

const isAfter = (end: string, start: string): boolean =>
  !!end && !!start && new Date(end) > new Date(start);

const CreateSlotModal = ({
  show,
  onHide,
  onCreated,
  contacts,
}: CreateSlotModalProps) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // Selected attendees, as contact GUIDs (max MAX_ATTENDEES).
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Picking a start auto-fills a sensible end (start + 30 min) when end is empty
  // or no longer after the new start — the admin can still override it.
  const handleStartChange = (value: string) => {
    setStart(value);
    if (value && (!end || !isAfter(end, value))) {
      setEnd(addMinutes(value, DEFAULT_DURATION));
    }
  };

  const attendeeOptions = useMemo(
    () => contacts.map((c) => ({ label: c.name, value: c.contactId })),
    [contacts]
  );

  const titleError = touched && !title.trim() ? 'A title is required.' : undefined;
  const startError = touched && !start ? 'A start date and time is required.' : undefined;
  const endError =
    touched && start && end && !isAfter(end, start)
      ? 'End must be after the start time.'
      : undefined;
  const attendeeError =
    touched && attendees.length === 0 ? 'Select at least one reviewer.' : undefined;

  const reset = () => {
    setTitle('');
    setStart('');
    setEnd('');
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
    if (!title.trim() || !start || !end || attendees.length === 0) return;
    if (!isAfter(end, start)) return;

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

          {/* Start + end on the same row */}
          <div className="slot-field-row">
            <DateTimeField
              name="slotStart"
              label="Start date & time"
              value={start}
              onChange={(e) => handleStartChange(e.target.value)}
              isRequired
              error={startError}
            />
            <DateTimeField
              name="slotEnd"
              label="End date & time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              isRequired
              error={endError}
            />
          </div>

          {/* Attendees — Reviewer-role contacts (up to MAX_ATTENDEES) */}
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
