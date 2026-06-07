import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import {
  ArrowLeft,
  CalendarDays,
  CalendarX2,
  Clock,
  Loader2,
  MapPin,
  Settings2,
} from 'lucide-react';
import { InlineMessage } from '../components/ui';
import { EditEngagementModal } from '../components/engagements/EditEngagementModal';
import {
  listEngagements,
  updateEngagementStatus,
} from '../shared/services/engagementService';
import { updateSlotStatus } from '../shared/services/slotService';
import { SLOT_STATUS_AVAILABLE } from '../data/slotChoices';
import {
  ENGAGEMENT_STATUS_CANCELLED,
  ENGAGEMENT_STATUS_COMPLETED,
  ENGAGEMENT_STATUS_SCHEDULED,
  engagementTypeChoices,
  ENGAGEMENT_TYPE_VIRTUAL,
} from '../data/engagementChoices';
import { getChoiceLabel } from '../data/types';
import type { Engagement } from '../types/engagement';

type Tab = 'scheduled' | 'completed' | 'cancelled';

const fmtDate = (d: string | null): string =>
  d
    ? new Date(d).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
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

const statusClassName = (status: number | null): string => {
  switch (status) {
    case ENGAGEMENT_STATUS_CANCELLED:
      return 'eng-status-cancelled';
    case ENGAGEMENT_STATUS_COMPLETED:
      return 'eng-status-completed';
    default:
      return 'eng-status-scheduled';
  }
};

export default function EngagementManagement() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('scheduled');
  const [notice, setNotice] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Engagement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Engagement | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await listEngagements();
      setEngagements(items.filter((e) => e.name && e.number));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { scheduled, completed, cancelled } = useMemo(() => {
    const sc: Engagement[] = [];
    const co: Engagement[] = [];
    const ca: Engagement[] = [];
    for (const e of engagements) {
      if (e.status === ENGAGEMENT_STATUS_SCHEDULED) sc.push(e);
      else if (e.status === ENGAGEMENT_STATUS_COMPLETED) co.push(e);
      else if (e.status === ENGAGEMENT_STATUS_CANCELLED) ca.push(e);
    }
    return { scheduled: sc, completed: co, cancelled: ca };
  }, [engagements]);

  const visible =
    tab === 'scheduled' ? scheduled : tab === 'completed' ? completed : cancelled;

  const handleSaved = () => {
    setEditTarget(null);
    setNotice('Engagement updated successfully.');
    void load();
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await updateEngagementStatus(cancelTarget.id, ENGAGEMENT_STATUS_CANCELLED);
      if (cancelTarget.slotId) {
        await updateSlotStatus(cancelTarget.slotId, SLOT_STATUS_AVAILABLE).catch(
          () => undefined
        );
      }
      setEngagements((prev) =>
        prev.map((e) =>
          e.id === cancelTarget.id
            ? { ...e, status: ENGAGEMENT_STATUS_CANCELLED, statusLabel: 'Cancelled' }
            : e
        )
      );
      setCancelTarget(null);
      setNotice('Engagement cancelled and its slot freed.');
    } catch {
      setLoadError('Failed to cancel engagement. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="urm-back">
          <Link to="/admin" className="urm-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Admin
          </Link>
        </div>

        {/* Hero header */}
        <div className="rq-header">
          <div className="rq-header-top">
            <CalendarDays size={22} aria-hidden="true" />
            <h1 className="rq-title">Engagement Management</h1>
            <span className="rq-count-badge">
              {scheduled.length} scheduled · {engagements.length} total
            </span>
          </div>
          <p className="rq-subtitle">
            Track and manage engagements across the group organisation.
          </p>
        </div>

        {notice && (
          <InlineMessage tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
            {notice}
          </InlineMessage>
        )}

        {loadError && (
          <InlineMessage tone="error" title="Couldn't load engagements" className="mb-3">
            {loadError}
          </InlineMessage>
        )}

        {/* Toolbar: status tabs */}
        <div className="slot-toolbar">
          <div className="slot-tabs" role="tablist" aria-label="Engagement status">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'scheduled'}
              className={`slot-tab${tab === 'scheduled' ? ' slot-tab-active' : ''}`}
              onClick={() => setTab('scheduled')}
            >
              Scheduled
              <span className="slot-tab-count">{scheduled.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'completed'}
              className={`slot-tab${tab === 'completed' ? ' slot-tab-active' : ''}`}
              onClick={() => setTab('completed')}
            >
              Completed
              <span className="slot-tab-count">{completed.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'cancelled'}
              className={`slot-tab${tab === 'cancelled' ? ' slot-tab-active' : ''}`}
              onClick={() => setTab('cancelled')}
            >
              Cancelled
              <span className="slot-tab-count">{cancelled.length}</span>
            </button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="urm-empty">
            <Loader2 size={20} className="rq-spinner" aria-hidden="true" />
            Loading engagements…
          </div>
        ) : visible.length === 0 ? (
          <div className="slot-empty">
            <CalendarX2 size={28} aria-hidden="true" />
            <p className="slot-empty-title">No {tab} engagements</p>
            <p className="slot-empty-sub">
              {tab === 'scheduled'
                ? 'Scheduled engagements will appear here once requests book a slot.'
                : `No ${tab} engagements to show.`}
            </p>
          </div>
        ) : (
          <div className="slot-grid">
            {visible.map((eng) => {
              const isScheduled = eng.status === ENGAGEMENT_STATUS_SCHEDULED;
              const typeLabel =
                eng.typeLabel ??
                getChoiceLabel(engagementTypeChoices, eng.type ?? -1) ??
                '—';
              return (
                <article key={eng.id} className="slot-card">
                  <div className="slot-card-head">
                    <span className="slot-card-date">{fmtDate(eng.date)}</span>
                    <span className={`eng-status-badge ${statusClassName(eng.status)}`}>
                      {eng.statusLabel ?? 'Scheduled'}
                    </span>
                  </div>

                  <div className="slot-card-time">
                    <span className="slot-card-time-range">
                      {fmtTime(eng.startTime)} – {fmtTime(eng.endTime)}
                    </span>
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

                  <h3 className="slot-card-title">
                    {eng.name || 'Untitled engagement'}
                    {eng.number ? <span className="eng-ref">{eng.number}</span> : null}
                  </h3>

                  <div className="slot-card-attendees">
                    {eng.location ? (
                      <span className="slot-card-attendee-names">
                        <MapPin size={14} aria-hidden="true" /> {eng.location}
                      </span>
                    ) : (
                      <span className="slot-card-noattendee">
                        <Clock size={14} aria-hidden="true" /> Virtual / no location
                      </span>
                    )}
                  </div>

                  {isScheduled && (
                    <div className="eng-card-actions">
                      <button
                        type="button"
                        className="slot-btn slot-btn-ghost"
                        onClick={() => setEditTarget(eng)}
                      >
                        <Settings2 size={15} aria-hidden="true" />
                        Manage
                      </button>
                      <button
                        type="button"
                        className="eng-cancel-btn"
                        onClick={() => setCancelTarget(eng)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <EditEngagementModal
        show={editTarget !== null}
        engagement={editTarget}
        onHide={() => setEditTarget(null)}
        onSaved={handleSaved}
      />

      {/* Cancel confirmation */}
      <Modal
        show={Boolean(cancelTarget)}
        onHide={() => setCancelTarget(null)}
        centered
      >
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
            onClick={() => void confirmCancel()}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Yes, cancel engagement'}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
