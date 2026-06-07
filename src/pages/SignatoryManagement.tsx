import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, PenLine, Search, Settings2, Trash2, UserCheck, Users } from 'lucide-react';
import { InlineMessage } from '../components/ui';
import { getCurrentUser } from '../services/authService';
import { listContacts } from '../shared/services/contactService';
import { escapeODataString } from '../shared/powerPagesApi';
import {
  isSignatoryApiConfigured,
  listSignatoryMembers,
  addSignatoryMember,
  removeSignatoryMember,
  getSignatoryThresholds,
  setSignatoryThresholds,
  type SignatoryMemberDto,
  type SignatoryThresholds,
} from '../shared/signatoryApi';
import type { Contact } from '../types/contact';

type Group = 'prepared' | 'confirmed';

export default function SignatoryManagement() {
  const loginHint = getCurrentUser()?.email ?? getCurrentUser()?.userName;

  const [members, setMembers] = useState<SignatoryMemberDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [thresholds, setThresholds] = useState<SignatoryThresholds>({ preparedCount: 1, confirmCount: 2 });
  const [thresholdDraft, setThresholdDraft] = useState<SignatoryThresholds>({ preparedCount: 1, confirmCount: 2 });
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const [group, setGroup] = useState<Group>('prepared');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactResolved, setContactResolved] = useState(false);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [data, t] = await Promise.all([
        listSignatoryMembers(loginHint),
        getSignatoryThresholds(loginHint),
      ]);
      setMembers(data);
      setThresholds(t);
      setThresholdDraft(t);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load signatory members');
    } finally {
      setIsLoading(false);
    }
  }, [loginHint]);

  const handleSaveThresholds = async () => {
    setIsSavingThresholds(true);
    setThresholdError(null);
    setThresholdSaved(false);
    try {
      const updated = await setSignatoryThresholds(
        thresholdDraft.preparedCount,
        thresholdDraft.confirmCount,
        loginHint
      );
      setThresholds(updated);
      setThresholdDraft(updated);
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 3000);
    } catch (e) {
      setThresholdError(e instanceof Error ? e.message : 'Failed to save thresholds');
    } finally {
      setIsSavingThresholds(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced contact search
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2 || contactResolved) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const filter = `contains(fullname,'${escapeODataString(q)}') or contains(emailaddress1,'${escapeODataString(q)}')`;
        const res = await listContacts({ filter, top: 10 });
        setSearchResults(res.items);
        setShowDropdown(res.items.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, contactResolved]);

  const handleSelectContact = (c: Contact) => {
    setName(c.fullName);
    setEmail(c.email);
    setContactResolved(true);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (contactResolved) setContactResolved(false);
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await addSignatoryMember(
        { name: trimmedName, email: trimmedEmail, group },
        loginHint
      );
      setMembers(updated);
      setName('');
      setEmail('');
      setContactResolved(false);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (member: SignatoryMemberDto) => {
    const groupLabel = member.group === 'prepared' ? 'Prepared' : 'Confirmed';
    if (!confirm(`Remove ${member.name} from the ${groupLabel} group?`)) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await removeSignatoryMember(member.id, loginHint);
      setMembers(updated);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepared = members.filter((m) => m.group === 'prepared');
  const confirmed = members.filter((m) => m.group === 'confirmed');
  const canAdd =
    isSignatoryApiConfigured && name.trim().length > 0 && email.trim().length > 0 && !isSubmitting;

  return (
    <section className="section">
      <div className="container">
        <div className="urm-back">
          <Link to="/admin" className="urm-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Admin
          </Link>
        </div>

        {/* ── Hero header ─────────────────────────────────────────────── */}
        <header className="urm-hero">
          <div className="urm-hero-main">
            <div className="urm-hero-eyebrow">
              <PenLine size={18} aria-hidden="true" />
              <span>Administration</span>
            </div>
            <h1 className="urm-hero-title">Signatory Groups</h1>
            <p className="urm-hero-sub">
              Manage members of the Prepared and Confirmed signature groups. These drive the
              signature grid on requests in Pending Review.
            </p>
          </div>
          <div className="urm-hero-badge">
            <Users size={15} aria-hidden="true" />
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
        </header>

        {!isSignatoryApiConfigured && (
          <InlineMessage tone="info" title="Not configured" className="mb-3">
            Set <code>VITE_UPLOAD_FN_BASEURL</code>, <code>VITE_MSAL_CLIENT_ID</code> and{' '}
            <code>VITE_UPLOAD_API_SCOPE</code> to enable managing signatories.
          </InlineMessage>
        )}

        {errorMessage && (
          <InlineMessage tone="error" title="Error" className="mb-3">
            {errorMessage}
          </InlineMessage>
        )}

        {/* ── Add member ──────────────────────────────────────────────── */}
        <div className="sig-add-card">
          <p className="sig-add-title">
            <UserCheck size={16} aria-hidden="true" />
            Add member
          </p>

          <div className="row g-3 align-items-end">
            {/* Group */}
            <div className="col-12 col-sm-6 col-lg-2">
              <label className="form-label">Group</label>
              <select
                className="form-select form-select-sm"
                value={group}
                onChange={(e) => setGroup(e.target.value as Group)}
              >
                <option value="prepared">Prepared</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>

            {/* Name with contact search autocomplete */}
            <div className="col-12 col-sm-6 col-lg" ref={searchRef}>
              <label className="form-label">Name</label>
              <div className="sig-search-wrap">
                <span className="sig-search-icon">
                  <Search size={14} aria-hidden="true" />
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm sig-search-input"
                  placeholder="Search or type a name…"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  autoComplete="off"
                />
                {isSearching && (
                  <span className="sig-search-spinner">
                    <Loader2 size={13} className="rq-spinner" aria-hidden="true" />
                  </span>
                )}
                {showDropdown && searchResults.length > 0 && (
                  <div className="sig-dropdown">
                    {searchResults.map((c) => (
                      <button
                        key={c.contactId}
                        type="button"
                        className="sig-dropdown-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectContact(c);
                        }}
                      >
                        <span className="sig-dropdown-name">{c.fullName}</span>
                        {c.email && (
                          <span className="sig-dropdown-email">{c.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="col-12 col-sm-6 col-lg">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control form-control-sm"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Add button */}
            <div className="col-12 col-sm-6 col-lg-auto">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!canAdd}
                onClick={() => void handleAdd()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="rq-spinner me-1" aria-hidden="true" />
                    Adding…
                  </>
                ) : (
                  'Add member'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Minimum signature thresholds ────────────────────────────── */}
        <div className="sig-threshold-card">
          <p className="sig-add-title">
            <Settings2 size={16} aria-hidden="true" />
            Minimum signature thresholds
          </p>
          <p className="sig-threshold-desc">
            Set the minimum number of signatures required in each group before a request can
            proceed from Pending Review.
          </p>
          <div className="row g-3 align-items-end">
            <div className="col-12 col-sm-auto">
              <label className="form-label" htmlFor="threshold-prepared">
                Prepared (minimum)
              </label>
              <input
                id="threshold-prepared"
                type="number"
                className="form-control form-control-sm sig-threshold-input"
                min={1}
                max={99}
                value={thresholdDraft.preparedCount}
                onChange={(e) =>
                  setThresholdDraft((d) => ({
                    ...d,
                    preparedCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                disabled={!isSignatoryApiConfigured || isSavingThresholds}
              />
            </div>
            <div className="col-12 col-sm-auto">
              <label className="form-label" htmlFor="threshold-confirmed">
                Confirmed (minimum)
              </label>
              <input
                id="threshold-confirmed"
                type="number"
                className="form-control form-control-sm sig-threshold-input"
                min={1}
                max={99}
                value={thresholdDraft.confirmCount}
                onChange={(e) =>
                  setThresholdDraft((d) => ({
                    ...d,
                    confirmCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                disabled={!isSignatoryApiConfigured || isSavingThresholds}
              />
            </div>
            <div className="col-12 col-sm-auto">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !isSignatoryApiConfigured ||
                  isSavingThresholds ||
                  (thresholdDraft.preparedCount === thresholds.preparedCount &&
                    thresholdDraft.confirmCount === thresholds.confirmCount)
                }
                onClick={() => void handleSaveThresholds()}
              >
                {isSavingThresholds ? (
                  <>
                    <Loader2 size={14} className="rq-spinner me-1" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save thresholds'
                )}
              </button>
            </div>
            {thresholdSaved && (
              <div className="col-12 col-sm-auto">
                <span className="sig-threshold-saved">Thresholds saved</span>
              </div>
            )}
          </div>
          {thresholdError && (
            <InlineMessage tone="error" className="mt-3">
              {thresholdError}
            </InlineMessage>
          )}
        </div>

        {/* ── Member lists ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="d-flex align-items-center gap-2 py-4 text-muted">
            <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
            Loading members…
          </div>
        ) : (
          <div className="sig-group-grid">
            <MemberList
              title="Prepared"
              members={prepared}
              onRemove={handleRemove}
              disabled={isSubmitting || !isSignatoryApiConfigured}
            />
            <MemberList
              title="Confirmed"
              members={confirmed}
              onRemove={handleRemove}
              disabled={isSubmitting || !isSignatoryApiConfigured}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function MemberList({
  title,
  members,
  onRemove,
  disabled,
}: {
  title: string;
  members: SignatoryMemberDto[];
  onRemove: (member: SignatoryMemberDto) => void;
  disabled: boolean;
}) {
  return (
    <div className="sig-panel">
      <div className="sig-panel-head">
        <PenLine size={15} aria-hidden="true" />
        {title}
        <span className="sig-panel-count">{members.length}</span>
      </div>
      {members.length === 0 ? (
        <p className="sig-panel-empty">No members yet.</p>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{m.email}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1"
                      disabled={disabled}
                      onClick={() => onRemove(m)}
                      aria-label={`Remove ${m.name}`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
