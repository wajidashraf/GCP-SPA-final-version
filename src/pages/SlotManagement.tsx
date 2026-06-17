import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  Loader2,
  Pencil,
  Plus,
  Users,
} from 'lucide-react';
import { InlineMessage } from '../components/ui';
import { CreateSlotModal } from '../components/slots/CreateSlotModal';
import type { AttendeeOption } from '../components/slots/CreateSlotModal';
import { EditSlotModal } from '../components/slots/EditSlotModal';
import { listSlots } from '../shared/services/slotService';
import { SLOT_STATUS_AVAILABLE } from '../data/slotChoices';
import type { Slot } from '../types/slot';
import { listContactsInRole } from '../shared/webRoleApi';
import { getCurrentUser } from '../services/authService';

/** Web role whose members are selectable as slot attendees. */
const ATTENDEE_ROLE = 'Reviewer';

type Tab = 'available' | 'booked';

const initials = (name: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const durationMins = (start: string | null, end: string | null): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
};

export default function SlotManagement() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('available');
  const [showCreate, setShowCreate] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [editTarget, setEditTarget] = useState<Slot | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [reviewers, setReviewers] = useState<AttendeeOption[]>([]);
  const [reviewersError, setReviewersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { items } = await listSlots();
      setSlots(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Load the Reviewer-role contacts that can be assigned as slot attendees.
  useEffect(() => {
    let cancelled = false;
    const loginHint = getCurrentUser()?.email ?? getCurrentUser()?.userName;
    listContactsInRole(ATTENDEE_ROLE, loginHint)
      .then((items) => {
        if (cancelled) return;
        setReviewers(
          items.map((c) => ({
            contactId: c.contactId,
            name: c.name || c.email,
            email: c.email,
          }))
        );
        setReviewersError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setReviewersError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { available, booked } = useMemo(() => {
    const av: Slot[] = [];
    const bk: Slot[] = [];
    for (const s of slots) {
      if (s.status === SLOT_STATUS_AVAILABLE) av.push(s);
      else bk.push(s);
    }
    return { available: av, booked: bk };
  }, [slots]);

  const visible = tab === 'available' ? available : booked;

  // Attendee picker source — contacts holding the Reviewer web role.
  const contacts = reviewers;

  const handleCreated = () => {
    setShowCreate(false);
    setCreatedNotice(true);
    setTab('available');
    void load();
  };

  const handleSaved = () => {
    setEditTarget(null);
    setSavedNotice(true);
    void load();
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
            <CalendarClock size={22} aria-hidden="true" />
            <h1 className="rq-title">Slot Management</h1>
            <span className="rq-count-badge">
              {available.length} available · {booked.length} booked
            </span>
          </div>
          <p className="rq-subtitle">Create and manage meeting and engagement slots.</p>
        </div>

        {createdNotice && (
          <InlineMessage
            tone="success"
            className="mb-3"
            onDismiss={() => setCreatedNotice(false)}
          >
            Slot created successfully and is now available for booking.
          </InlineMessage>
        )}

        {savedNotice && (
          <InlineMessage
            tone="success"
            className="mb-3"
            onDismiss={() => setSavedNotice(false)}
          >
            Slot updated successfully.
          </InlineMessage>
        )}

        {loadError && (
          <InlineMessage tone="error" title="Couldn't load slots" className="mb-3">
            {loadError}
          </InlineMessage>
        )}

        {reviewersError && (
          <InlineMessage
            tone="warning"
            title="Couldn't load reviewers"
            className="mb-3"
          >
            The list of selectable reviewers couldn't be loaded, so the attendee
            picker may be empty. {reviewersError}
          </InlineMessage>
        )}

        {/* Toolbar: tabs + create */}
        <div className="slot-toolbar">
          <div className="slot-tabs" role="tablist" aria-label="Slot status">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'available'}
              className={`slot-tab${tab === 'available' ? ' slot-tab-active' : ''}`}
              onClick={() => setTab('available')}
            >
              Available
              <span className="slot-tab-count">{available.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'booked'}
              className={`slot-tab${tab === 'booked' ? ' slot-tab-active' : ''}`}
              onClick={() => setTab('booked')}
            >
              Booked
              <span className="slot-tab-count">{booked.length}</span>
            </button>
          </div>

          <button
            type="button"
            className="slot-btn slot-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Create new slot
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="urm-empty">
            <Loader2 size={20} className="rq-spinner" aria-hidden="true" />
            Loading slots…
          </div>
        ) : visible.length === 0 ? (
          <div className="slot-empty">
            <CalendarX2 size={28} aria-hidden="true" />
            <p className="slot-empty-title">
              No {tab} slots {tab === 'available' ? 'yet' : ''}
            </p>
            <p className="slot-empty-sub">
              {tab === 'available'
                ? 'Create a slot to make it available for booking.'
                : 'Booked slots will appear here once attendees reserve them.'}
            </p>
          </div>
        ) : (
          <div className="slot-grid">
            {visible.map((slot) => {
              const mins = durationMins(slot.start, slot.end);
              const isAvailable = slot.status === SLOT_STATUS_AVAILABLE;
              return (
                <article key={slot.id} className="slot-card">
                  <div className="slot-card-head">
                    <span className="slot-card-date">{fmtDate(slot.start)}</span>
                    <div className="slot-card-head-right">
                      <span
                        className={`rq-status-pill ${
                          isAvailable ? 'status-available' : 'status-booked'
                        }`}
                      >
                        <span className="rq-status-dot" />
                        {isAvailable ? 'Available' : slot.statusLabel ?? 'Booked'}
                      </span>
                      <button
                        type="button"
                        className="slot-edit-btn"
                        onClick={() => setEditTarget(slot)}
                        aria-label="Edit slot"
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="slot-card-time">
                    <span className="slot-card-time-range">
                      {fmtTime(slot.start)} – {fmtTime(slot.end)}
                    </span>
                    {mins != null && (
                      <span className="slot-card-duration">{mins} min</span>
                    )}
                  </div>

                  <h3 className="slot-card-title">{slot.title || 'Untitled slot'}</h3>

                  <div className="slot-card-attendees">
                    {slot.attendees.length === 0 ? (
                      <span className="slot-card-noattendee">
                        <Users size={14} aria-hidden="true" /> No attendees
                      </span>
                    ) : (
                      <>
                        <div className="slot-avatars">
                          {slot.attendees.map((a) => (
                            <span
                              key={a.contactId}
                              className="slot-avatar"
                              title={a.name ?? undefined}
                            >
                              {initials(a.name)}
                            </span>
                          ))}
                        </div>
                        <span className="slot-card-attendee-names">
                          {slot.attendees
                            .map((a) => a.name)
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <CreateSlotModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onCreated={handleCreated}
        contacts={contacts}
      />

      <EditSlotModal
        show={editTarget !== null}
        slot={editTarget}
        onHide={() => setEditTarget(null)}
        onSaved={handleSaved}
        contacts={contacts}
      />
    </section>
  );
}
