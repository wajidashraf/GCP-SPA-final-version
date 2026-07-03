import { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Edit, Loader2, X } from 'lucide-react';
import { DateTimeField, MultiSelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import { getChoiceLabel } from '../../data/types';
import { slotStatusChoices } from '../../data/slotChoices';
import { updateSlot, MAX_ATTENDEES } from '../../shared/services/slotService';
import type { Slot } from '../../types/slot';
import type { AttendeeOption } from './CreateSlotModal';

type EditSlotModalProps = {
  show: boolean;
  slot: Slot | null;
  onHide: () => void;
  onSaved: () => void;
  contacts: AttendeeOption[];
};

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const isoToLocal = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toLocalInput(d);
};

const localToIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const EditSlotModal = ({ show, slot, onHide, onSaved, contacts }: EditSlotModalProps) => {
  // Editable: start, end, reviewers. Title and status are shown read-only.
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Re-seed all fields whenever a different slot is opened. (The modal stays
  // mounted across opens, so useState initialisers alone would never refresh.)
  useEffect(() => {
    if (!slot) return;
    setStart(isoToLocal(slot.start));
    setEnd(isoToLocal(slot.end));
    setAttendees(slot.attendees.slice(0, MAX_ATTENDEES).map((a) => a.contactId));
    setError(null);
    setTouched(false);
  }, [slot]);

  // Merge existing slot attendees into the selectable options so they're always
  // visible even if they no longer hold the Reviewer role.
  const mergedContacts = useMemo<AttendeeOption[]>(() => {
    if (!slot) return contacts;
    const seen = new Set(contacts.map((c) => c.contactId));
    const extras = slot.attendees
      .filter((a) => !seen.has(a.contactId))
      .map((a) => ({
        contactId: a.contactId,
        name: a.name ?? a.contactId,
        email: a.email,
      }));
    return [...contacts, ...extras];
  }, [contacts, slot]);

  const attendeeOptions = useMemo(
    () => mergedContacts.map((c) => ({ label: c.name, value: c.contactId })),
    [mergedContacts]
  );

  const startError = touched && !start ? 'A start date and time is required.' : undefined;
  const endError =
    touched && start && end && new Date(end) <= new Date(start)
      ? 'End must be after the start time.'
      : undefined;

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSave = async () => {
    setTouched(true);
    if (!slot) return;
    if (!start || !end) return;
    if (new Date(end) <= new Date(start)) return;

    setSubmitting(true);
    setError(null);
    try {
      const byId = new Map(mergedContacts.map((c) => [c.contactId, c]));
      // Fill all three attendee slots; null explicitly clears unused slots.
      const attendeesPayload = Array.from({ length: MAX_ATTENDEES }, (_, i) => {
        const id = attendees[i];
        if (!id) return null;
        return { contactId: id, email: byId.get(id)?.email ?? null };
      });

      // Only the editable timing fields are written — title and status are
      // left untouched (admin can change start/time and reviewers only).
      await updateSlot(
        slot.id,
        {
          gcp_date: localToIso(start),
          gcp_start: localToIso(start),
          gcp_end: localToIso(end),
        },
        { attendees: attendeesPayload }
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
            <p className="slot-modal-sub">Update the slot's time and reviewers.</p>
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

          {/* Read-only basic info (prepopulated from the record) */}
          <div className="slot-field-row">
            <TextField
              name="editSlotTitle"
              label="Title / type"
              value={slot?.title ?? ''}
              isReadOnly
            />
            <TextField
              name="editSlotStatus"
              label="Status"
              value={
                slot?.statusLabel ??
                (slot?.status != null
                  ? getChoiceLabel(slotStatusChoices, slot.status)
                  : '')
              }
              isReadOnly
            />
          </div>

          {/* Editable: start + end on the same row */}
          <div className="slot-field-row">
            <DateTimeField
              name="editSlotStart"
              label="Start date & time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              isRequired
              error={startError}
            />
            <DateTimeField
              name="editSlotEnd"
              label="End date & time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              isRequired
              error={endError}
            />
          </div>

          <MultiSelectField
            name="editAttendees"
            label="Reviewers"
            value={attendees}
            onChange={setAttendees}
            options={attendeeOptions}
            maxSelected={MAX_ATTENDEES}
            placeholder="Select reviewers"
            emptyText="No reviewers available."
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
