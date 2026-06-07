import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, HelpCircle, Info, Loader2, Mail, RotateCcw, Save, X } from 'lucide-react';
import { InlineMessage } from '../components/ui';
import { CheckboxField, EmailTemplateBlockEditor, SelectField } from '../forms';
import type { SelectOption } from '../forms';
import { isAdmin } from '../utils/authorization';
import {
  emailEvents,
  defaultTemplate,
  getEventPlaceholders,
  recipientRoleLabels,
} from '../data/emailTemplateEvents';
import type { EventKey, RecipientRole } from '../data/emailTemplateEvents';
import {
  createEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
} from '../shared/services/emailTemplateService';
import type { EmailBlock, EmailTemplate } from '../types/emailTemplate';
import { renderEmailHtml, renderSubject } from '../shared/emailTemplate/renderTemplate';
import type { TemplateData } from '../shared/emailTemplate/renderTemplate';

// Admins edit lifecycle email templates here. Reads/writes go through the Power Pages
// Web API (emailTemplateService) gated by an Administrators table permission — the
// isAdmin() check below is UX only. One template per (event × recipient role); the
// send-side Azure Function renders the chosen template with live request data.

type Selection = { eventKey: EventKey; role: RecipientRole };

type Draft = {
  id: string | null; // null = not yet created in Dataverse
  subject: string;
  blocks: EmailBlock[];
  active: boolean;
};

const keyOf = (eventKey: string, role: string) => `${eventKey}::${role}`;

// Build the preview data map from an event's placeholder sample values.
const sampleDataFor = (eventKey: EventKey): TemplateData => {
  const data: TemplateData = {};
  for (const p of getEventPlaceholders(eventKey)) data[p.token] = p.sample;
  return data;
};

export default function EmailTemplateManagement() {
  const callerIsAdmin = isAdmin();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Index templates by (eventKey × role) for quick lookup.
  const byKey = useMemo(() => {
    const m = new Map<string, EmailTemplate>();
    for (const t of templates) m.set(keyOf(t.eventKey, t.recipientRole), t);
    return m;
  }, [templates]);

  // Flatten every (event × recipient role) into dropdown options for the top selector.
  const templateOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [];
    for (const ev of emailEvents) {
      for (const role of ev.recipientRoles) {
        opts.push({
          value: keyOf(ev.key, role),
          label: `${ev.label} — ${recipientRoleLabels[role]}`,
        });
      }
    }
    return opts;
  }, []);

  useEffect(() => {
    if (!callerIsAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listEmailTemplates()
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [callerIsAdmin]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline]
  );

  const select = (eventKey: EventKey, role: RecipientRole) => {
    const existing = byKey.get(keyOf(eventKey, role));
    const next: Draft = existing
      ? { id: existing.id, subject: existing.subject, blocks: existing.blocks, active: existing.active }
      : { id: null, ...defaultTemplate(eventKey, role), active: true };
    setSelection({ eventKey, role });
    setDraft(next);
    setBaseline(next);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const onSelectTemplate = (raw: string) => {
    if (!raw) return;
    const [eventKey, role] = raw.split('::');
    select(eventKey as EventKey, role as RecipientRole);
  };

  const discard = () => {
    if (baseline) setDraft({ ...baseline });
    setSaveError(null);
    setSaveSuccess(false);
  };

  const save = async () => {
    if (!selection || !draft || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const ev = emailEvents.find((e) => e.key === selection.eventKey);
    const payload = {
      gcp_emailtemplate1: `${ev?.label ?? selection.eventKey} → ${recipientRoleLabels[selection.role]}`,
      gcp_eventkey: selection.eventKey,
      gcp_recipientrole: selection.role,
      gcp_subject: draft.subject,
      gcp_bodyblocks: JSON.stringify(draft.blocks),
      gcp_active: draft.active,
    };
    try {
      let id = draft.id;
      if (id) {
        await updateEmailTemplate(id, payload);
      } else {
        id = await createEmailTemplate(payload);
      }
      // Re-sync local state + cache so badges + baseline reflect what's saved.
      const saved: EmailTemplate = {
        id,
        name: payload.gcp_emailtemplate1,
        eventKey: selection.eventKey,
        recipientRole: selection.role,
        subject: draft.subject,
        blocks: draft.blocks,
        active: draft.active,
      };
      setTemplates((prev) => {
        const rest = prev.filter((t) => t.id !== id);
        return [...rest, saved];
      });
      const newDraft: Draft = { id, subject: draft.subject, blocks: draft.blocks, active: draft.active };
      setDraft(newDraft);
      setBaseline(newDraft);
      setSaveSuccess(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Non-admin gate (UX only) ────────────────────────────────────────────────
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
          <InlineMessage tone="warning" title="Administrators only" className="mt-3">
            You need the Administrators web role to manage email templates.
          </InlineMessage>
        </div>
      </section>
    );
  }

  const previewHtml =
    draft && selection
      ? renderEmailHtml(draft.blocks, sampleDataFor(selection.eventKey))
      : '';
  const previewSubject =
    draft && selection ? renderSubject(draft.subject, sampleDataFor(selection.eventKey)) : '';

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
              <Mail size={18} aria-hidden="true" />
              <span>Administration</span>
            </div>
            <div className="et-hero-title-row">
              <h1 className="urm-hero-title">Email Templates</h1>
              <button
                type="button"
                className="et-help-btn"
                onClick={() => setShowHelp(true)}
                aria-label="How Email Templates Work — open help"
              >
                <HelpCircle size={16} aria-hidden="true" />
                <span>Help</span>
              </button>
            </div>
            <p className="urm-hero-sub">
              Edit the notification sent at each step of the request lifecycle. Choose a template
              from the dropdown, edit its content in the toolbox, preview alongside, then save.
            </p>
          </div>
        </header>

        {loadError && (
          <InlineMessage tone="error" title="Couldn't load templates" className="mb-3">
            {loadError}
          </InlineMessage>
        )}

        {isLoading ? (
          <div className="urm-userlist-empty">
            <Loader2 size={18} className="rq-spinner" aria-hidden="true" />
            Loading templates…
          </div>
        ) : (
          <>
            {/* ── Top: template selector ── */}
            <div className="et-selectbar">
              <div className="et-selectbar-field">
                <SelectField
                  name="template-select"
                  label="Template"
                  options={templateOptions}
                  value={selection ? keyOf(selection.eventKey, selection.role) : ''}
                  onChange={(e) => onSelectTemplate(e.target.value)}
                  placeholder="Select a template to edit…"
                  helpText="One template per workflow event and recipient role."
                />
              </div>
              {selection && (
                <span className="et-selectbar-status">
                  {!byKey.get(keyOf(selection.eventKey, selection.role)) ? (
                    <span className="et-badge et-badge-missing">Not set</span>
                  ) : draft?.active ? (
                    <span className="et-badge et-badge-on">On</span>
                  ) : (
                    <span className="et-badge et-badge-off">Off</span>
                  )}
                </span>
              )}
            </div>

            {!selection || !draft ? (
              <div className="et-empty-state">
                <div className="et-empty-icon">
                  <Mail size={32} aria-hidden="true" />
                </div>
                <p className="et-empty-title">No template selected</p>
                <p className="et-empty-sub">
                  Choose an event and recipient role from the dropdown above to start editing.
                </p>
              </div>
            ) : (
              <>
                {/* ── Workspace: config toolbox (left) + preview (right) ── */}
                <div className="et-workspace">
                  {/* Config toolbox */}
                  <aside className="et-panel et-toolbox" aria-label="Template configuration">
                    <div className="et-panel-header">
                      <div className="et-panel-title-block">
                        <span className="et-panel-event-label">
                          {emailEvents.find((e) => e.key === selection.eventKey)?.label}
                        </span>
                        <ChevronRight size={15} className="et-panel-arrow" aria-hidden="true" />
                        <span className="et-panel-role-label">
                          {recipientRoleLabels[selection.role]}
                        </span>
                      </div>
                      <div className="et-panel-controls">
                        <CheckboxField
                          name="template-active"
                          label="Active (send this email)"
                          checked={draft.active}
                          onChange={() => setDraft({ ...draft, active: !draft.active })}
                        />
                      </div>
                    </div>

                    <div className="et-panel-body et-toolbox-body">
                      {saveError && (
                        <InlineMessage tone="error" title="Couldn't save" className="mb-3">
                          {saveError}
                        </InlineMessage>
                      )}
                      {saveSuccess && !dirty && (
                        <InlineMessage tone="success" title="Template saved" className="mb-3">
                          Changes were saved in Dataverse.
                        </InlineMessage>
                      )}

                      <EmailTemplateBlockEditor
                        subject={draft.subject}
                        onSubjectChange={(subject) => setDraft({ ...draft, subject })}
                        blocks={draft.blocks}
                        onBlocksChange={(blocks) => setDraft({ ...draft, blocks })}
                        placeholders={getEventPlaceholders(selection.eventKey)}
                      />
                    </div>
                  </aside>

                  {/* Preview */}
                  <main className="et-panel et-preview-panel et-preview-col">
                    <div className="et-panel-header">
                      <div className="et-panel-title">Live Preview</div>
                      <div className="et-preview-meta">
                        <Info size={13} aria-hidden="true" />
                        <span>Using sample data — real values are substituted on send</span>
                      </div>
                    </div>
                    <div className="et-preview-subject-bar">
                      <span className="et-preview-subject-key">Subject</span>
                      <span className="et-preview-subject-val">
                        {previewSubject || <em className="et-preview-empty">(empty subject)</em>}
                      </span>
                    </div>
                    <iframe
                      className="et-preview-frame"
                      title="Email preview"
                      srcDoc={previewHtml}
                    />
                  </main>
                </div>

                {/* Footer: dirty state + actions */}
                <div className="et-footer">
                  <span className={`et-dirty-flag${dirty ? ' is-dirty' : ' is-clean'}`}>
                    {dirty ? 'Unsaved changes' : 'All changes saved'}
                  </span>
                  <div className="et-footer-actions">
                    <button
                      type="button"
                      className="et-discard-btn"
                      onClick={discard}
                      disabled={!dirty || saving}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Discard
                    </button>
                    <button
                      type="button"
                      className="et-save-btn"
                      onClick={save}
                      disabled={!dirty || saving}
                    >
                      {saving ? (
                        <Loader2 size={15} className="rq-spinner" aria-hidden="true" />
                      ) : (
                        <Save size={15} aria-hidden="true" />
                      )}
                      {saving ? 'Saving…' : 'Save template'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Help modal ── */}
      {showHelp && (
        <div
          className="et-modal-backdrop"
          onClick={() => setShowHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How Email Templates Work"
        >
          <div className="et-modal" onClick={(e) => e.stopPropagation()}>
            <div className="et-modal-header">
              <div className="et-modal-title-row">
                <HelpCircle size={20} className="et-modal-icon" aria-hidden="true" />
                <h2 className="et-modal-title">How Email Templates Work</h2>
              </div>
              <button
                type="button"
                className="et-modal-close"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="et-modal-body">
              <section className="et-help-section">
                <h3 className="et-help-heading">Overview</h3>
                <p className="et-help-text">
                  Each workflow event — <strong>Request Submitted</strong>,{' '}
                  <strong>Request Verified</strong>, and <strong>Request Reviewed</strong> — can
                  send notification emails to different recipient roles (Requester, Verifier,
                  Reviewer, etc.). Select an event and recipient role from the dropdown at the
                  top to open and edit its template.
                </p>
              </section>

              <section className="et-help-section">
                <h3 className="et-help-heading">Placeholder Tokens</h3>
                <p className="et-help-text">
                  Placeholders like{' '}
                  <code className="et-help-code">{'{{requestName}}'}</code> and{' '}
                  <code className="et-help-code">{'{{requestNumber}}'}</code> are automatically
                  replaced with real request data when the email is sent.
                </p>
                <p className="et-help-text">
                  <strong>To insert a placeholder:</strong> click into any text field in the
                  editor, then click a chip in the <em>Placeholder Palette</em> — the chip is
                  inserted at the end of the focused field.
                </p>
              </section>

              <section className="et-help-section">
                <h3 className="et-help-heading">Block Types</h3>
                <ul className="et-help-list">
                  <li>
                    <strong>Heading</strong> — A large title line. Supports placeholders.
                  </li>
                  <li>
                    <strong>Paragraph</strong> — Body text. Supports placeholders.
                  </li>
                  <li>
                    <strong>Info Rows</strong> — A key-value table showing request details. Each
                    row has a <em>Label</em> (left column) and a <em>Value</em> (right column,
                    supports placeholders). Example: Label = "Request Number", Value ={' '}
                    <code className="et-help-code">{'{{requestNumber}}'}</code>.
                  </li>
                  <li>
                    <strong>Button</strong> — A call-to-action link. Use{' '}
                    <code className="et-help-code">{'{{viewLink}}'}</code> as the URL to link
                    directly to the request.
                  </li>
                  <li>
                    <strong>Divider</strong> — A horizontal separator line between sections.
                  </li>
                </ul>
              </section>

              <section className="et-help-section">
                <h3 className="et-help-heading">Active Toggle</h3>
                <p className="et-help-text">
                  When a template is marked <strong>Active</strong>, the Azure Function will send
                  this email when the corresponding event fires. Inactive templates are skipped —
                  useful for disabling a notification without deleting the template.
                </p>
              </section>

              <section className="et-help-section">
                <h3 className="et-help-heading">Preview</h3>
                <p className="et-help-text">
                  The <em>Live Preview</em> panel beside the toolbox renders the email using sample
                  placeholder values so you can see how it will look before saving. Real request
                  data is substituted when the email is actually sent by the Azure Function.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
