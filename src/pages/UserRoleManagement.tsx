import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { InlineMessage } from '../components/ui';
import { CheckboxField } from '../forms';
import { listContacts } from '../shared/services/contactService';
import type { Contact } from '../types/contact';
import { webRoles as staticWebRoles } from '../data/webRoles';
import {
  isRoleApiConfigured,
  getContactRoles,
  setWebRoleAssignment,
  type WebRoleDto,
} from '../shared/webRoleApi';
import { getCurrentUser } from '../services/authService';
import { isAdmin } from '../utils/authorization';

// Admins manage portal web roles here. Reads/writes go through a secure Azure
// Function (src/shared/webRoleApi) that talks to the Dataverse Web API as an
// application user and re-checks admin rights server-side — the isAdmin() gate
// below is UX only.
//
// UX model: pick a user in the left sidebar, tick/untick role checkboxes, then
// Save. Changes are batched and only written on Save; switching users while
// there are unsaved edits is blocked until the admin saves or discards.

const sameSet = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

export default function UserRoleManagement() {
  const callerIsAdmin = isAdmin();
  const loginHint = getCurrentUser()?.email ?? getCurrentUser()?.userName;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Canonical web-role catalog: the site's own roles from src/data/webRoles.ts.
  // (The live Dataverse table is the unified `powerpagecomponent` store, which
  // contains duplicate-named legacy rows — the static catalog mirrors the GUIDs
  // the portal runtime actually honours, so we list from it.)
  const roles = useMemo<WebRoleDto[]>(
    () => staticWebRoles.map((r) => ({ id: r.id, name: r.name })),
    []
  );

  // Role editor state for the selected contact.
  const [selected, setSelected] = useState<Contact | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set()); // what's in Dataverse
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set()); // pending edits
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // When the admin clicks another user with unsaved edits, we stash the target
  // here and surface a confirm banner instead of silently dropping changes.
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);

  const dirty = useMemo(() => !sameSet(savedIds, draftIds), [savedIds, draftIds]);

  // Load contacts once (admins only).
  useEffect(() => {
    if (!callerIsAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listContacts({ top: 100 })
      .then(({ items }) => {
        if (!cancelled) setContacts(items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callerIsAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.fullName} ${c.email}`.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Load a contact's roles into both the saved + draft sets.
  const loadContact = (contact: Contact) => {
    setSelected(contact);
    setEditorError(null);
    setSaveSuccess(false);
    setSavedIds(new Set());
    setDraftIds(new Set());
    setEditorLoading(true);
    getContactRoles(contact.contactId, loginHint)
      .then((current) => {
        const ids = new Set(current.map((r) => r.id));
        setSavedIds(ids);
        setDraftIds(new Set(ids));
      })
      .catch((err: unknown) =>
        setEditorError(err instanceof Error ? err.message : String(err))
      )
      .finally(() => setEditorLoading(false));
  };

  // Selecting from the sidebar — guard unsaved edits.
  const handleSelect = (contact: Contact) => {
    if (contact.contactId === selected?.contactId) return;
    if (dirty) {
      setPendingContact(contact);
      return;
    }
    loadContact(contact);
  };

  const confirmSwitch = () => {
    if (pendingContact) loadContact(pendingContact);
    setPendingContact(null);
  };

  const cancelSwitch = () => setPendingContact(null);

  const toggleDraftRole = (roleId: string) => {
    setSaveSuccess(false);
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const discardChanges = () => {
    setDraftIds(new Set(savedIds));
    setEditorError(null);
    setSaveSuccess(false);
  };

  // Apply the diff: assign added roles, unassign removed ones. Each call returns
  // the contact's resulting role set, so we re-sync from the last response.
  const saveChanges = async () => {
    if (!selected || !dirty || saving) return;
    const toAssign = [...draftIds].filter((id) => !savedIds.has(id));
    const toUnassign = [...savedIds].filter((id) => !draftIds.has(id));

    setSaving(true);
    setEditorError(null);
    setSaveSuccess(false);
    try {
      let latest: WebRoleDto[] | null = null;
      for (const roleId of toAssign) {
        latest = await setWebRoleAssignment(selected.contactId, roleId, 'assign', loginHint);
      }
      for (const roleId of toUnassign) {
        latest = await setWebRoleAssignment(selected.contactId, roleId, 'unassign', loginHint);
      }
      const ids = latest
        ? new Set(latest.map((r) => r.id))
        : new Set(draftIds);
      setSavedIds(ids);
      setDraftIds(new Set(ids));
      setSaveSuccess(true);
    } catch (err: unknown) {
      setEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Non-admin gate (UX only; the Function enforces this server-side) ────────
  if (!callerIsAdmin) {
    return (
      <section className="section">
        <div className="container">
          <div className="urm-back">
            <Link to="/admin" className="urm-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Admin
            </Link>
          </div>
          <header className="urm-hero">
            <div className="urm-hero-main">
              <div className="urm-hero-eyebrow">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Administration</span>
              </div>
              <h1 className="urm-hero-title">User Role Management</h1>
            </div>
          </header>
          <InlineMessage tone="warning" title="Administrators only" className="mt-3">
            You need the Administrators web role to manage user roles.
          </InlineMessage>
        </div>
      </section>
    );
  }

  const draftCount = draftIds.size;

  return (
    <section className="section">
      <div className="container">
        <div className="urm-back">
          <Link to="/admin" className="urm-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Admin
          </Link>
        </div>

        {/* ── Themed hero header ─────────────────────────────────────────── */}
        <header className="urm-hero">
          <div className="urm-hero-main">
            <div className="urm-hero-eyebrow">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Administration</span>
            </div>
            <h1 className="urm-hero-title">User Role Management</h1>
            <p className="urm-hero-sub">
              Select a user, set their portal web roles, then save your changes.
            </p>
          </div>
          <div className="urm-hero-badge">
            <Users size={15} aria-hidden="true" />
            {contacts.length} {contacts.length === 1 ? 'user' : 'users'}
          </div>
        </header>

        {!isRoleApiConfigured && (
          <InlineMessage tone="info" title="Role editing not configured" className="mb-3">
            Set <code>VITE_UPLOAD_FN_BASEURL</code>, <code>VITE_MSAL_CLIENT_ID</code>{' '}
            and <code>VITE_UPLOAD_API_SCOPE</code> to enable assigning roles.
          </InlineMessage>
        )}

        {loadError && (
          <InlineMessage tone="error" title="Couldn’t load contacts" className="mb-3">
            {loadError}
          </InlineMessage>
        )}

        {/* ── Master / detail layout ─────────────────────────────────────── */}
        <div className="urm-layout">
          {/* Sidebar: searchable user list */}
          <aside className="urm-sidebar" aria-label="Users">
            <div className="urm-search">
              <Search size={16} aria-hidden="true" className="urm-search-icon" />
              <input
                type="search"
                className="urm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search users"
              />
            </div>
            <div className="urm-sidebar-count">
              {filtered.length} of {contacts.length} shown
            </div>

            {isLoading ? (
              <div className="urm-userlist-empty">
                <Loader2 size={18} className="rq-spinner" aria-hidden="true" />
                Loading users…
              </div>
            ) : filtered.length === 0 ? (
              <div className="urm-userlist-empty">No users match your search.</div>
            ) : (
              <ul className="urm-userlist">
                {filtered.map((c) => {
                  const active = selected?.contactId === c.contactId;
                  return (
                    <li key={c.contactId}>
                      <button
                        type="button"
                        className={`urm-user-item${active ? ' is-active' : ''}`}
                        onClick={() => handleSelect(c)}
                        disabled={!isRoleApiConfigured}
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className="urm-user-avatar" aria-hidden="true">
                          {(c.fullName || c.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="urm-user-text">
                          <span className="urm-user-name">{c.fullName || '—'}</span>
                          <span className="urm-user-email">{c.email || 'No email'}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Detail: role editor for the selected user */}
          <div className="urm-detail">
            {!selected ? (
              <div className="urm-detail-empty">
                <UserCog size={32} aria-hidden="true" />
                <p>Select a user from the list to manage their roles.</p>
              </div>
            ) : (
              <>
                <div className="urm-detail-head">
                  <span className="urm-detail-avatar" aria-hidden="true">
                    {(selected.fullName || selected.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="urm-detail-id">
                    <h2 className="urm-detail-name">
                      {selected.fullName || selected.email || 'Unnamed user'}
                    </h2>
                    {selected.email && (
                      <div className="urm-detail-email">{selected.email}</div>
                    )}
                    {selected.parentAccountName && (
                      <div className="urm-detail-account">{selected.parentAccountName}</div>
                    )}
                  </div>
                  <span className="urm-detail-rolecount">
                    {draftCount} {draftCount === 1 ? 'role' : 'roles'}
                  </span>
                </div>

                {/* Unsaved-changes guard when switching users */}
                {pendingContact && (
                  <InlineMessage tone="warning" title="Unsaved changes" className="mb-3">
                    You have unsaved role changes for{' '}
                    <strong>{selected.fullName || selected.email}</strong>. Save or
                    discard them before switching.
                    <span className="urm-switch-actions">
                      <button type="button" className="urm-link-btn" onClick={confirmSwitch}>
                        Discard &amp; switch
                      </button>
                      <button type="button" className="urm-link-btn" onClick={cancelSwitch}>
                        Keep editing
                      </button>
                    </span>
                  </InlineMessage>
                )}

                {editorError && (
                  <InlineMessage tone="error" title="Couldn’t update roles" className="mb-3">
                    {editorError}
                  </InlineMessage>
                )}

                {saveSuccess && !dirty && (
                  <InlineMessage tone="success" title="Roles saved" className="mb-3">
                    Changes were applied in Dataverse.
                  </InlineMessage>
                )}

                {editorLoading ? (
                  <div className="urm-userlist-empty">
                    <Loader2 size={18} className="rq-spinner" aria-hidden="true" />
                    Loading roles…
                  </div>
                ) : (
                  <>
                    <fieldset className="urm-roles-fieldset" disabled={saving}>
                      <legend className="urm-roles-legend">Web roles</legend>
                      <div className="urm-roles-grid">
                        {roles.map((role) => {
                          const checked = draftIds.has(role.id);
                          const changed = checked !== savedIds.has(role.id);
                          return (
                            <div
                              key={role.id}
                              className={`urm-role-check${checked ? ' is-on' : ''}${
                                changed ? ' is-changed' : ''
                              }`}
                            >
                              <CheckboxField
                                name={`role-${role.id}`}
                                label={role.name}
                                checked={checked}
                                onChange={() => toggleDraftRole(role.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="urm-detail-footer">
                      <span className="urm-dirty-flag">
                        {dirty ? (
                          <>
                            <span className="urm-dirty-dot" aria-hidden="true" />
                            Unsaved changes
                          </>
                        ) : (
                          'All changes saved'
                        )}
                      </span>
                      <div className="urm-footer-actions">
                        <button
                          type="button"
                          className="urm-discard-btn"
                          onClick={discardChanges}
                          disabled={!dirty || saving}
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          Discard
                        </button>
                        <button
                          type="button"
                          className="urm-save-btn"
                          onClick={saveChanges}
                          disabled={!dirty || saving}
                        >
                          {saving ? (
                            <Loader2 size={15} className="rq-spinner" aria-hidden="true" />
                          ) : (
                            <Save size={15} aria-hidden="true" />
                          )}
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </div>

                    <div className="note urm-note">
                      <Info size={16} aria-hidden="true" />
                      <span>
                        Changes apply in Dataverse on save. Users may need to sign
                        out and back in for new permissions to take effect.
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
