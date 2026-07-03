// src/components/letters/LetterDocument.tsx
// Renders an Acknowledgement / Endorsement letter from a LetterTemplate.
//
// Variables resolve in two ways:
//   • AUTO  — variable.auto(ctx) returns a value → rendered read-only.
//   • MANUAL— no auto value → rendered as an inline <input> in edit mode, or
//             a highlighted «placeholder» when empty and read-only.
//
// Persistence helpers (parse/serialize) keep a human-readable letter in the
// Dataverse memo field and append a machine-readable marker so the manual
// values can be restored for re-editing.

import type {
  LetterContext,
  LetterTemplate,
  LetterVariable,
  Segment,
} from './letterTemplates';
import { CC_LIST } from './letterTemplates';

const titlePrefix = (template: LetterTemplate): string =>
  template.kind === 'ACK' ? 'REVIEW AND ACKNOWLEDGEMENT' : 'ENDORSEMENT';

/** Auto value for a variable, or null when it should be entered manually. */
const autoValue = (v: LetterVariable, ctx: LetterContext): string | null => {
  const a = v.auto?.(ctx);
  return a && a.trim() ? a : null;
};

/** Final display value: auto wins, else the manual entry, else ''. */
const finalValue = (
  v: LetterVariable,
  ctx: LetterContext,
  values: Record<string, string>,
): string => autoValue(v, ctx) ?? values[v.key] ?? '';

// ── Persistence ─────────────────────────────────────────────────────────────

const MARKER = '\n\n<!--GCP_LETTER:';
const MARKER_END = '-->';

export interface StoredLetter {
  templateKey: string;
  values: Record<string, string>;
}

/** Pull saved manual values out of a stored letter field (JSON marker). */
export const parseStoredLetter = (
  raw: string | null | undefined,
): StoredLetter | null => {
  if (!raw) return null;
  const start = raw.indexOf(MARKER);
  if (start === -1) return null;
  const jsonStart = start + MARKER.length;
  const end = raw.indexOf(MARKER_END, jsonStart);
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, end)) as StoredLetter;
    if (parsed && typeof parsed.templateKey === 'string') {
      return { templateKey: parsed.templateKey, values: parsed.values ?? {} };
    }
  } catch {
    /* fall through */
  }
  return null;
};

/** Build the plain-text letter body (no marker). */
export const renderLetterText = (
  template: LetterTemplate,
  ctx: LetterContext,
  values: Record<string, string>,
  letterNumber: string,
): string => {
  const byKey = new Map(template.variables.map((v) => [v.key, v]));
  const val = (key: string): string => {
    const v = byKey.get(key);
    if (!v) return `<${key}>`;
    const out = finalValue(v, ctx, values);
    return out || `<${v.label}>`;
  };
  const seg = (segments: Segment[]): string =>
    segments.map((s) => (typeof s === 'string' ? s : val(s.var))).join('');

  const lines: string[] = [];
  lines.push(`${titlePrefix(template)} (${template.documentTitle})`);
  lines.push(`${template.kind === 'ACK' ? 'ACKNOWLEDGEMENT' : 'ENDORSEMENT'} NO.: ${letterNumber || '—'}`);
  lines.push('');
  for (const key of template.infoRowKeys) {
    const v = byKey.get(key);
    if (v) lines.push(`${v.label}: ${val(key)}`);
  }
  lines.push('');
  lines.push(`Dear ${ctx.request.companyName ?? 'Sir/Madam'},`);
  lines.push('');
  for (const p of template.paragraphs) lines.push(seg(p));
  // Freeform letters (Acknowledgement) stop at the body.
  if (!template.freeform) {
    lines.push('');
    lines.push(template.signoff);
    lines.push('');
    lines.push('Attachments:');
    template.attachments.forEach((a) => lines.push(`- ${a}`));
    lines.push('');
    lines.push('cc.');
    CC_LIST.forEach((c) => lines.push(`- ${c}`));
  }
  return lines.join('\n');
};

/** Render the letter + append the machine-readable marker for re-editing. */
export const serializeLetter = (
  template: LetterTemplate,
  ctx: LetterContext,
  values: Record<string, string>,
  letterNumber: string,
): string => {
  // Persist only manual values (auto values are always re-derived).
  const manual: Record<string, string> = {};
  for (const v of template.variables) {
    if (autoValue(v, ctx) === null && values[v.key]?.trim()) {
      manual[v.key] = values[v.key].trim();
    }
  }
  const payload: StoredLetter = { templateKey: template.key, values: manual };
  return `${renderLetterText(template, ctx, values, letterNumber)}${MARKER}${JSON.stringify(payload)}${MARKER_END}`;
};

// ── Component ───────────────────────────────────────────────────────────────

export interface LetterDocumentProps {
  template: LetterTemplate;
  ctx: LetterContext;
  values: Record<string, string>;
  letterNumber: string;
  editing: boolean;
  onChange: (key: string, value: string) => void;
}

export default function LetterDocument({
  template,
  ctx,
  values,
  letterNumber,
  editing,
  onChange,
}: LetterDocumentProps) {
  const byKey = new Map(template.variables.map((v) => [v.key, v]));

  /** Render one variable cell/span (table or inline). */
  const renderVar = (key: string) => {
    const v = byKey.get(key);
    if (!v) return null;
    const auto = autoValue(v, ctx);
    if (auto !== null) {
      // Auto-filled from the request → read-only.
      return <span className="lp-var lp-var--auto">{auto}</span>;
    }
    const current = values[v.key] ?? '';
    if (editing) {
      if (v.multiline) {
        return (
          <textarea
            className="lp-var-input lp-var-textarea"
            rows={8}
            value={current}
            placeholder={v.placeholder ?? v.label}
            aria-label={v.label}
            onChange={(e) => onChange(v.key, e.target.value)}
          />
        );
      }
      return (
        <input
          className="lp-var-input"
          type="text"
          value={current}
          placeholder={v.placeholder ?? v.label}
          aria-label={v.label}
          onChange={(e) => onChange(v.key, e.target.value)}
        />
      );
    }
    if (current) {
      return (
        <span className={`lp-var${v.multiline ? ' lp-var--multiline' : ''}`}>
          {current}
        </span>
      );
    }
    return <span className="lp-var lp-var--blank">«{v.label}»</span>;
  };

  const kindWord = template.kind === 'ACK' ? 'ACKNOWLEDGEMENT' : 'ENDORSEMENT';

  return (
    <article className="lp-doc">
      {/* ── Document title ───────────────────────────────────────────── */}
      <header className="lp-doc-header">
        <h2 className="lp-doc-title">{titlePrefix(template)}</h2>
        <p className="lp-doc-sub">({template.documentTitle})</p>
      </header>

      {/* ── Info table with black header bar (kind word + letter no.) ── */}
      <table className="lp-info-table">
        <thead>
          <tr>
            <th className="lp-info-bar" colSpan={2}>
              {kindWord} NO.: {letterNumber || '—'}
            </th>
          </tr>
        </thead>
        <tbody>
          {template.infoRowKeys.map((key) => {
            const v = byKey.get(key);
            if (!v) return null;
            return (
              <tr key={key}>
                <th>{v.label}</th>
                <td>{renderVar(key)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Salutation ───────────────────────────────────────────────── */}
      <p className="lp-salutation">
        Dear <strong>{ctx.request.companyName ?? 'Sir/Madam'}</strong>,
      </p>

      {/* ── Body paragraphs ──────────────────────────────────────────── */}
      <div className="lp-letter-content">
        {template.paragraphs.map((p, i) => (
          <p key={i} className="lp-paragraph">
            {p.map((s, j) =>
              typeof s === 'string' ? (
                <span key={j}>{s}</span>
              ) : (
                <span key={j}>{renderVar(s.var)}</span>
              ),
            )}
          </p>
        ))}
      </div>

      {/* Freeform letters (Acknowledgement) end at the body — no sign-off,
          attachments or cc sections below the reviewer's text. */}
      {!template.freeform ? (
        <>
          {/* ── Sign-off (centered) ──────────────────────────────────── */}
          <div className="lp-signoff">
            <div className="lp-signrule" aria-hidden="true">
              …………………………………………….
            </div>
            {template.signoff.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          {/* ── Attachments ──────────────────────────────────────────── */}
          <div className="lp-section">
            <p className="lp-section-title">Attachments:</p>
            <ol className="lp-list">
              {template.attachments.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>

          {/* ── CC list ──────────────────────────────────────────────── */}
          <div className="lp-section">
            <p className="lp-section-title">cc.</p>
            <ul className="lp-list lp-list--plain">
              {CC_LIST.map((cc) => (
                <li key={cc}>
                  <em>{cc}</em>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </article>
  );
}
