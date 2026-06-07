// src/pages/Engagement.tsx
// Schedule / manage reviewer engagements for a request. Reached from the
// "Book Engagement" button on RequestDetail (shown while status is Draft Review).
//
// Two views in one page:
//   • List  — existing engagements for the request, with cancel.
//   • Form  — pick an available reviewer slot and schedule a new engagement.
// A request may only have one *scheduled* engagement at a time.

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react';
import { InlineMessage, LoadingState } from '../components/ui';
import { SelectField, TextField } from '../forms';
import { useAuth } from '../context/AuthContext';
import { getRequestById, updateRequest } from '../shared/services/requestService';
import {
  listAvailableSlotsWithin,
  updateSlotStatus,
} from '../shared/services/slotService';
import {
  createEngagement,
  listEngagementsByRequest,
  updateEngagementStatus,
} from '../shared/services/engagementService';
import type { Engagement as EngagementRecord } from '../types/engagement';
import type { Slot } from '../types/slot';
import { SLOT_STATUS_AVAILABLE, SLOT_STATUS_BOOKED } from '../data/slotChoices';
import {
  ENGAGEMENT_STATUS_CANCELLED,
  ENGAGEMENT_STATUS_COMPLETED,
  ENGAGEMENT_STATUS_SCHEDULED,
  ENGAGEMENT_TYPE_PHYSICAL,
  ENGAGEMENT_TYPE_VIRTUAL,
  engagementLocationOptions,
  engagementTypeChoices,
  OTHER_LOCATION_VALUE,
} from '../data/engagementChoices';
import { getChoiceLabel, toSelectOptions } from '../data/types';
import { matterChoices } from '../data/matterChoices';

// ── Formatting helpers ───────────────────────────────────────────────────────
const fmtDate = (d: string | null): string =>
  d
    ? new Date(d).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

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

const statusClassName = (status: number | null): string => {
  switch (status) {
    case ENGAGEMENT_STATUS_SCHEDULED:
      return 'eng-status-scheduled';
    case ENGAGEMENT_STATUS_CANCELLED:
      return 'eng-status-cancelled';
    case ENGAGEMENT_STATUS_COMPLETED:
      return 'eng-status-completed';
    default:
      return 'eng-status-scheduled';
  }
};

export default function Engagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const matterType = Number(searchParams.get('type')) || null;
  const matterLabel = useMemo(
    () => matterChoices.find((m) => m.value === matterType)?.label ?? null,
    [matterType]
  );

  // ── Data ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState<string | null>(null);
  const [engagements, setEngagements] = useState<EngagementRecord[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // ── View / form state ─────────────────────────────────────────────────────
  const [mode, setMode] = useState<'list' | 'form'>('form');
  const [name, setName] = useState('');
  const [month, setMonth] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [type, setType] = useState(String(ENGAGEMENT_TYPE_VIRTUAL));
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scheduledBlock, setScheduledBlock] = useState(false);

  // ── Cancel modal ──────────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<EngagementRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const [request, engs, availableSlots] = await Promise.all([
          getRequestById(id),
          listEngagementsByRequest(id),
          listAvailableSlotsWithin(6).catch(() => [] as Slot[]),
        ]);
        if (cancelled) return;
        const visible = engs.filter((e) => e.name && e.number);
        setRequestTitle(request?.title ?? null);
        setEngagements(visible);
        setSlots(availableSlots);
        setMode(visible.length > 0 ? 'list' : 'form');
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : 'Failed to load engagement data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasScheduled = useMemo(
    () => engagements.some((e) => e.status === ENGAGEMENT_STATUS_SCHEDULED),
    [engagements]
  );

  const nextNumber = useMemo(() => {
    const completed = engagements.filter(
      (e) => e.status === ENGAGEMENT_STATUS_COMPLETED
    ).length;
    return `R${String(completed + 1).padStart(2, '0')}`;
  }, [engagements]);

  // Months that have available slots, with counts.
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

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId]
  );

  const isPhysical = Number(type) === ENGAGEMENT_TYPE_PHYSICAL;

  const goBack = () => navigate(id ? `/requests/${id}` : '/requests');

  const startNewEngagement = () => {
    if (hasScheduled) {
      setScheduledBlock(true);
      return;
    }
    setScheduledBlock(false);
    setMode('form');
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!id) {
      setSubmitError('Missing request ID.');
      return;
    }
    if (hasScheduled) {
      setScheduledBlock(true);
      return;
    }
    if (!name.trim()) {
      setSubmitError('Please enter an engagement name.');
      return;
    }
    if (!selectedSlot) {
      setSubmitError('Please select a time slot.');
      return;
    }

    let resolvedLocation: string | null = null;
    if (isPhysical) {
      resolvedLocation =
        location === OTHER_LOCATION_VALUE ? customLocation.trim() : location;
      if (!resolvedLocation) {
        setSubmitError('Please choose or enter a meeting location.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createEngagement(
        {
          gcp_name: name.trim(),
          gcp_engagementnumber: nextNumber,
          gcp_engagementdate: selectedSlot.date
            ? new Date(selectedSlot.date).toISOString()
            : new Date().toISOString(),
          gcp_starttime: selectedSlot.start,
          gcp_endtime: selectedSlot.end,
          gcp_engagementtype: Number(type) as typeof ENGAGEMENT_TYPE_VIRTUAL,
          gcp_engagementstatus: ENGAGEMENT_STATUS_SCHEDULED,
          gcp_location: resolvedLocation,
        },
        {
          slotId: selectedSlot.id,
          requestId: id,
          createdByContactId: user?.contactId,
          attendeeContactId: selectedSlot.attendees[0]?.contactId ?? null,
        }
      );
      // Mark the slot as booked so it leaves the available pool.
      await updateSlotStatus(selectedSlot.id, SLOT_STATUS_BOOKED);
      // Advance request status to R (3).
      await updateRequest(id, { gcp_requeststatus: 3 });
      setSuccess(true);
      setTimeout(goBack, 1500);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Failed to schedule engagement: ${err.message}`
          : 'Failed to schedule engagement. Please try again.'
      );
      setSubmitting(false);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await updateEngagementStatus(cancelTarget.id, ENGAGEMENT_STATUS_CANCELLED);
      if (cancelTarget.slotId && cancelTarget.startTime) {
        const msTilStart = new Date(cancelTarget.startTime).getTime() - Date.now();
        if (msTilStart > 2 * 60 * 60 * 1000) {
          await updateSlotStatus(cancelTarget.slotId, SLOT_STATUS_AVAILABLE).catch(
            () => undefined
          );
        }
      }
      setEngagements((prev) =>
        prev.map((e) =>
          e.id === cancelTarget.id
            ? { ...e, status: ENGAGEMENT_STATUS_CANCELLED, statusLabel: 'Cancelled' }
            : e
        )
      );
      setCancelTarget(null);
    } catch {
      setSubmitError('Failed to cancel engagement. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="rd-page">
      <div className="container">
        <div className="rd-back">
          <button type="button" className="rd-back-link" onClick={goBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to request
          </button>
        </div>

        {loading ? <LoadingState message="Loading engagements…" size="lg" /> : null}

        {loadError ? (
          <InlineMessage tone="error" title="Couldn’t load engagements">
            {loadError}
          </InlineMessage>
        ) : null}

        {!loading && !loadError ? (
          <div className="eng-card">
            {mode === 'list' ? (
              <>
                <header className="eng-head">
                  <div>
                    <h1 className="eng-title">Scheduled Engagements</h1>
                    <p className="eng-sub">
                      {matterLabel ? `${matterLabel} · ` : ''}
                      {requestTitle ?? 'Request'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rd-verify-btn"
                    onClick={startNewEngagement}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Create Engagement
                  </button>
                </header>

                <div className="eng-body">
                  {scheduledBlock ? (
                    <InlineMessage tone="warning" title="Engagement already scheduled">
                      Please complete or cancel the existing scheduled engagement
                      before creating a new one.
                    </InlineMessage>
                  ) : null}

                  {engagements.length === 0 ? (
                    <div className="eng-empty">
                      <CalendarDays size={40} aria-hidden="true" />
                      <p>No engagements scheduled yet</p>
                    </div>
                  ) : (
                    <div className="eng-list">
                      {engagements.map((eng) => {
                        const canCancel = eng.status === ENGAGEMENT_STATUS_SCHEDULED;
                        const typeLabel =
                          eng.typeLabel ??
                          getChoiceLabel(engagementTypeChoices, eng.type ?? -1) ??
                          '—';
                        return (
                          <div key={eng.id} className="eng-item">
                            <div className="eng-item-head">
                              <div className="eng-item-title">
                                {eng.name}
                                {eng.number ? (
                                  <span className="eng-ref">{eng.number}</span>
                                ) : null}
                                <span
                                  className={`eng-type-badge ${
                                    eng.type === ENGAGEMENT_TYPE_VIRTUAL
                                      ? 'eng-type-virtual'
                                      : 'eng-type-inperson'
                                  }`}
                                >
                                  {typeLabel}
                                </span>
                              </div>
                              <div className="eng-item-actions">
                                <span
                                  className={`eng-status-badge ${statusClassName(
                                    eng.status
                                  )}`}
                                >
                                  {eng.statusLabel ?? 'Scheduled'}
                                </span>
                                {canCancel ? (
                                  <button
                                    type="button"
                                    className="eng-cancel-btn"
                                    onClick={() => setCancelTarget(eng)}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div className="eng-item-meta">
                              <span>
                                <CalendarDays size={14} aria-hidden="true" />
                                {fmtDate(eng.date)}
                              </span>
                              <span>
                                <Clock size={14} aria-hidden="true" />
                                {fmtTime(eng.startTime)} – {fmtTime(eng.endTime)}
                              </span>
                              {eng.location ? (
                                <span>
                                  <MapPin size={14} aria-hidden="true" />
                                  {eng.location}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <header className="eng-head">
                  <div>
                    <h1 className="eng-title">
                      Schedule Engagement
                      <span className="eng-ref">{nextNumber}</span>
                    </h1>
                    <p className="eng-sub">
                      {matterLabel ? `${matterLabel} · ` : ''}
                      {requestTitle ?? 'Request'}
                    </p>
                  </div>
                </header>

                <form className="eng-body" onSubmit={handleSubmit} noValidate>
                  {success ? (
                    <InlineMessage tone="success" title="Engagement scheduled">
                      Redirecting back to the request…
                    </InlineMessage>
                  ) : null}

                  {hasScheduled ? (
                    <InlineMessage tone="warning" title="Engagement already scheduled">
                      You already have a scheduled engagement for this request.
                      Complete or cancel it before scheduling a new one.
                    </InlineMessage>
                  ) : null}

                  <TextField
                    name="engagementName"
                    label="Engagement Name"
                    isRequired
                    placeholder="Enter engagement name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    isReadOnly={submitting}
                  />

                  <SelectField
                    name="month"
                    label="Select Month"
                    isRequired
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
                        ? 'No available slots in the next 6 months.'
                        : undefined
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
                              <span className="eng-slot-date">
                                {fmtDateShort(slot.date)}
                              </span>
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

                  {submitError ? (
                    <InlineMessage tone="error" title="Couldn’t schedule">
                      {submitError}
                    </InlineMessage>
                  ) : null}

                  <div className="eng-actions">
                    <button
                      type="button"
                      className="vd-btn-secondary"
                      onClick={goBack}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rd-verify-btn"
                      disabled={submitting || success}
                    >
                      <CalendarPlus size={16} aria-hidden="true" />
                      Schedule Engagement
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Cancel confirmation */}
      <Modal show={Boolean(cancelTarget)} onHide={() => setCancelTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Engagement</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Are you sure you want to cancel this engagement?</p>
          <InlineMessage tone="warning">
            This marks the engagement as cancelled and frees its time slot.
          </InlineMessage>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="vd-btn-secondary"
            onClick={() => setCancelTarget(null)}
            disabled={cancelling}
          >
            No, keep it
          </button>
          <button
            type="button"
            className="eng-cancel-btn eng-cancel-btn--solid"
            onClick={confirmCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Yes, cancel engagement'}
          </button>
        </Modal.Footer>
      </Modal>

      {success ? (
        <div className="eng-toast" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          Engagement scheduled successfully
        </div>
      ) : null}
    </section>
  );
}
