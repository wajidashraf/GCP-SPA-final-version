import { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { CalendarClock, Clock, Loader2, X } from 'lucide-react';
import { SelectField, TextField } from '../../forms';
import { InlineMessage } from '../ui';
import {
  ENGAGEMENT_TYPE_PHYSICAL,
  ENGAGEMENT_TYPE_VIRTUAL,
  engagementLocationOptions,
  engagementTypeChoices,
  OTHER_LOCATION_VALUE,
} from '../../data/engagementChoices';
import { toSelectOptions } from '../../data/types';
import { SLOT_STATUS_AVAILABLE, SLOT_STATUS_BOOKED } from '../../data/slotChoices';
import {
  listAvailableSlotsWithin,
  updateSlotStatus,
} from '../../shared/services/slotService';
import { updateEngagement } from '../../shared/services/engagementService';
import type { Engagement } from '../../types/engagement';
import type { Slot } from '../../types/slot';

type EditEngagementModalProps = {
  show: boolean;
  engagement: Engagement | null;
  onHide: () => void;
  onSaved: () => void;
};

const fmtDateShort = (d: string | null): string =>
  d
    ? new Date(d).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '—';

const fmtTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

const durationMins = (start: string | null, end: string | null): number => {
  if (!start || !end) return 0;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
};

const monthKeyOf = (d: string): string => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Decide the initial location select + custom value from a stored free-text location. */
const resolveInitialLocation = (
  location: string | null
): { location: string; custom: string } => {
  if (!location) return { location: '', custom: '' };
  const preset = engagementLocationOptions.find(
    (o) => o.value === location && o.value !== OTHER_LOCATION_VALUE
  );
  return preset
    ? { location, custom: '' }
    : { location: OTHER_LOCATION_VALUE, custom: location };
};

const EditEngagementModal = ({
  show,
  engagement,
  onHide,
  onSaved,
}: EditEngagementModalProps) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [month, setMonth] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [type, setType] = useState(String(ENGAGEMENT_TYPE_VIRTUAL));
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise form state whenever a new engagement is opened.
  useEffect(() => {
    if (!show || !engagement) return;
    setType(String(engagement.type ?? ENGAGEMENT_TYPE_VIRTUAL));
    const init = resolveInitialLocation(engagement.location);
    setLocation(init.location);
    setCustomLocation(init.custom);
    setMonth('');
    setSelectedSlotId('');
    setError(null);

    let cancelled = false;
    listAvailableSlotsWithin(6)
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [show, engagement]);

  const isPhysical = Number(type) === ENGAGEMENT_TYPE_PHYSICAL;

  const monthOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const s of slots) {
      if (!s.date) continue;
      const key = monthKeyOf(s.date);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else
        counts.set(key, {
          label: new Date(s.date).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          }),
          count: 1,
        });
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, { label, count }]) => ({
        value,
        label: `${label} (${count} slot${count === 1 ? '' : 's'} available)`,
      }));
  }, [slots]);

  const slotsForMonth = useMemo(() => {
    if (!month) return [];
    return slots
      .filter((s) => s.date && monthKeyOf(s.date) === month)
      .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  }, [slots, month]);

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSave = async () => {
    if (!engagement) return;
    setError(null);

    let resolvedLocation: string | null = null;
    if (isPhysical) {
      resolvedLocation =
        location === OTHER_LOCATION_VALUE ? customLocation.trim() : location;
      if (!resolvedLocation) {
        setError('Please choose or enter a meeting location.');
        return;
      }
    }

    const newSlot =
      selectedSlotId && selectedSlotId !== engagement.slotId
        ? slots.find((s) => s.id === selectedSlotId) ?? null
        : null;

    setSubmitting(true);
    try {
      await updateEngagement(
        engagement.id,
        {
          gcp_engagementtype: Number(type) as typeof ENGAGEMENT_TYPE_VIRTUAL,
          gcp_location: resolvedLocation,
          ...(newSlot
            ? {
                gcp_engagementdate: newSlot.date
                  ? new Date(newSlot.date).toISOString()
                  : undefined,
                gcp_starttime: newSlot.start,
                gcp_endtime: newSlot.end,
              }
            : {}),
        },
        newSlot
          ? {
              slotId: newSlot.id,
              attendeeContactId: newSlot.attendees[0]?.contactId ?? null,
            }
          : {}
      );

      // Re-book/free slots when the slot changed.
      if (newSlot) {
        await updateSlotStatus(newSlot.id, SLOT_STATUS_BOOKED);
        if (engagement.slotId) {
          await updateSlotStatus(engagement.slotId, SLOT_STATUS_AVAILABLE).catch(
            () => undefined
          );
        }
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to update engagement: ${err.message}`
          : 'Failed to update engagement. Please try again.'
      );
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
      aria-labelledby="edit-engagement-title"
    >
      <div className="slot-modal">
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <CalendarClock size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="edit-engagement-title" className="slot-modal-title">
              Manage engagement
            </h2>
            <p className="slot-modal-sub">
              {engagement?.name ?? 'Engagement'}
              {engagement?.number ? ` · ${engagement.number}` : ''}
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
            <InlineMessage tone="error" title="Couldn't save" className="mb-3">
              {error}
            </InlineMessage>
          )}

          {/* Current slot */}
          <div className="slot-endtime">
            <span className="slot-endtime-label">Current slot</span>
            <span className="slot-endtime-value">
              {engagement?.startTime
                ? `${fmtDateShort(engagement.date)}, ${fmtTime(
                    engagement.startTime
                  )} – ${fmtTime(engagement.endTime)}`
                : '—'}
            </span>
          </div>

          {/* Reschedule — pick a different available slot */}
          <SelectField
            name="rescheduleMonth"
            label="Reschedule (optional)"
            placeholder="Choose a month to view available slots"
            options={monthOptions}
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelectedSlotId('');
            }}
            isReadOnly={submitting}
            helpText={
              monthOptions.length === 0
                ? 'No available slots in the next 6 months — slot stays unchanged.'
                : 'Leave unselected to keep the current slot.'
            }
          />

          {month ? (
            <div className="eng-slots">
              <span className="rd-field-label">
                Available Time Slots{' '}
                <span className="eng-slot-count">
                  ({slotsForMonth.length} available)
                </span>
              </span>
              {slotsForMonth.length === 0 ? (
                <div className="eng-empty eng-empty--sm">
                  <Clock size={32} aria-hidden="true" />
                  <p>No available slots for this month</p>
                </div>
              ) : (
                <div className="eng-slot-grid">
                  {slotsForMonth.map((slot) => (
                    <button
                      type="button"
                      key={slot.id}
                      className={`eng-slot${
                        slot.id === selectedSlotId ? ' is-selected' : ''
                      }`}
                      onClick={() => setSelectedSlotId(slot.id)}
                      disabled={submitting}
                    >
                      <span className="eng-slot-date">{fmtDateShort(slot.date)}</span>
                      <span className="eng-slot-dur">
                        {durationMins(slot.start, slot.end)} minutes
                      </span>
                      <span className="eng-slot-time">
                        {fmtTime(slot.start)} – {fmtTime(slot.end)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <SelectField
            name="engagementType"
            label="Engagement Type"
            isRequired
            options={toSelectOptions(engagementTypeChoices)}
            value={type}
            onChange={(e) => setType(e.target.value)}
            isReadOnly={submitting}
          />

          {isPhysical ? (
            <>
              <SelectField
                name="engagementLocation"
                label="Meeting Location"
                isRequired
                placeholder="Select a location"
                options={[...engagementLocationOptions]}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                isReadOnly={submitting}
              />
              {location === OTHER_LOCATION_VALUE ? (
                <TextField
                  name="customLocation"
                  label="Custom Location"
                  isRequired
                  placeholder="Enter meeting location"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  isReadOnly={submitting}
                />
              ) : null}
            </>
          ) : null}
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
                <CalendarClock size={16} aria-hidden="true" />
                Save changes
              </>
            )}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default EditEngagementModal;
export { EditEngagementModal };
