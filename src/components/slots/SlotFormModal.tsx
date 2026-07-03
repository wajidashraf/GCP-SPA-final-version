import { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { CalendarPlus, Loader2, Pencil, X } from 'lucide-react';
import { DateTimeField, MultiSelectField, SelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import { toSelectOptions } from '../../data/types';
import { SLOT_STATUS_AVAILABLE, slotDurationChoices } from '../../data/slotChoices';
import { createSlot, updateSlot, MAX_ATTENDEES } from '../../shared/services/slotService';
import type { Slot } from '../../types/slot';

/** A contact (Reviewer) that can be picked as a slot attendee. */
export type AttendeeOption = {
  contactId: string;
  name: string;
  email?: string | null;
};

type SlotFormMode = 'create' | 'edit';

type SlotFormModalProps = {
  /** `create` opens an empty form; `edit` prefills from `slot`. */
  mode: SlotFormMode;
  show: boolean;
  onHide: () => void;
  /** Called after the slot is created or saved (so the list can refresh). */
  onSaved: () => void;
  /** Reviewer-role contacts selectable as attendees. */
  contacts: AttendeeOption[];
  /** The slot being edited — required for `edit`, ignored for `create`. */
  slot?: Slot | null;
};

const DEFAULT_DURATION = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as a local `YYYY-MM-DDTHH:mm` string for datetime-local inputs. */
const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;

/** Convert a Dataverse ISO UTC string to a local `datetime-local` string. */
const isoToLocal = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toLocalInput(d);
};

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

/** Whole minutes between two ISO instants, or null if not a positive span. */
const diffMinutes = (startIso: string | null, endIso: string | null): number | null => {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
};

/** Friendly display of the auto-computed end instant (from a local string). */
const fmtEnds = (local: string): string => {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SlotFormModal = ({
  mode,
  show,
  onHide,
  onSaved,
  contacts,
  slot,
}: SlotFormModalProps) => {
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  // Meeting duration in minutes — the end datetime is derived from start + this.
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  // Selected attendees, as contact GUIDs (max MAX_ATTENDEES).
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // (Re)seed every field whenever the modal opens (or a different slot is
  // opened). The modal stays mounted across opens, so useState initialisers
  // alone would never refresh.
  useEffect(() => {
    if (!show) return;
    if (isEdit && slot) {
      setTitle(slot.title ?? '');
      setStart(isoToLocal(slot.start));
      setDuration(diffMinutes(slot.start, slot.end) ?? DEFAULT_DURATION);
      setAttendees(slot.attendees.slice(0, MAX_ATTENDEES).map((a) => a.contactId));
    } else {
      setTitle('');
      setStart('');
      setDuration(DEFAULT_DURATION);
      setAttendees([]);
    }
    setError(null);
    setTouched(false);
  }, [show, isEdit, slot]);

  // In edit mode, merge the slot's existing attendees into the selectable
  // options so they stay visible even if they no longer hold the Reviewer role.
  const mergedContacts = useMemo<AttendeeOption[]>(() => {
    if (!isEdit || !slot) return contacts;
    const seen = new Set(contacts.map((c) => c.contactId));
    const extras = slot.attendees
      .filter((a) => !seen.has(a.contactId))
      .map((a) => ({
        contactId: a.contactId,
        name: a.name ?? a.contactId,
        email: a.email,
      }));
    return [...contacts, ...extras];
  }, [contacts, isEdit, slot]);

  const attendeeOptions = useMemo(
    () => mergedContacts.map((c) => ({ label: c.name, value: c.contactId })),
    [mergedContacts]
  );

  // Standard durations, plus the slot's current duration if it isn't a preset,
  // so editing prefills faithfully without silently changing the end time.
  const durationOptions = useMemo(() => {
    const base = toSelectOptions(slotDurationChoices);
    if (base.some((o) => o.value === String(duration))) return base;
    return [{ label: `${duration} minutes`, value: String(duration) }, ...base].sort(
      (a, b) => Number(a.value) - Number(b.value)
    );
  }, [duration]);

  // End datetime is always derived from the chosen start + duration.
  const endLocal = addMinutes(start, duration);

  const titleError = touched && !title.trim() ? 'A title is required.' : undefined;
  const startError = touched && !start ? 'A start date and time is required.' : undefined;
  const attendeeError =
    touched && attendees.length === 0 ? 'Select at least one reviewer.' : undefined;

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!title.trim() || !start || !duration || attendees.length === 0) return;

    const endValue = addMinutes(start, duration);
    if (!endValue) return;

    const endIso = localToIso(endValue);
    // Rescheduling a slot's end into the future reopens it for booking.
    const endInFuture = !!endIso && new Date(endIso).getTime() > Date.now();

    const byId = new Map(mergedContacts.map((c) => [c.contactId, c]));

    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && slot) {
        // Fill all three attendee slots; null explicitly clears unused slots.
        const attendeesPayload = Array.from({ length: MAX_ATTENDEES }, (_, i) => {
          const id = attendees[i];
          if (!id) return null;
          return { contactId: id, email: byId.get(id)?.email ?? null };
        });
        await updateSlot(
          slot.id,
          {
            gcp_type: title.trim(),
            gcp_date: localToIso(start),
            gcp_start: localToIso(start),
            gcp_end: endIso,
            // If the new end is in the future, mark the slot Available again.
            ...(endInFuture ? { gcp_slotstatus: SLOT_STATUS_AVAILABLE } : {}),
          },
          { attendees: attendeesPayload }
        );
      } else {
        const selected = attendees.map((id) => ({
          contactId: id,
          email: byId.get(id)?.email ?? null,
        }));
        await createSlot(
          {
            gcp_type: title.trim(),
            gcp_slotstatus: SLOT_STATUS_AVAILABLE,
            gcp_date: localToIso(start),
            gcp_start: localToIso(start),
            gcp_end: endIso,
          },
          { attendees: selected }
        );
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const HeadIcon = isEdit ? Pencil : CalendarPlus;

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
      dialogClassName="slot-modal-dialog"
      aria-labelledby="slot-form-title"
    >
      <div className="slot-modal">
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <HeadIcon size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="slot-form-title" className="slot-modal-title">
              {isEdit ? 'Edit slot' : 'Create new slot'}
            </h2>
            <p className="slot-modal-sub">
              {isEdit
                ? "Update the slot's details, timing and reviewers."
                : 'Open a meeting or engagement slot for booking.'}
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
            <InlineMessage
              tone="error"
              title={isEdit ? "Couldn't save slot" : "Couldn't create slot"}
              className="mb-3"
            >
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

          {/* Start + meeting duration on the same row. End is auto-computed. */}
          <div className="slot-field-row">
            <DateTimeField
              name="slotStart"
              label="Start date & time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              isRequired
              error={startError}
            />
            <SelectField
              name="slotDuration"
              label="Meeting duration"
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
              options={durationOptions}
              isRequired
              helpText={
                endLocal
                  ? `Ends at ${fmtEnds(endLocal)}`
                  : 'Pick a start time to see the end time.'
              }
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
                {isEdit ? 'Saving…' : 'Creating…'}
              </>
            ) : (
              <>
                <HeadIcon size={16} aria-hidden="true" />
                {isEdit ? 'Save changes' : 'Create slot'}
              </>
            )}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default SlotFormModal;
export { SlotFormModal };
export type { SlotFormModalProps };
