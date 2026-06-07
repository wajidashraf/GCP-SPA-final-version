// api/src/email/renderTemplate.ts
// Pure, dependency-free renderer: (blocks, data) -> branded HTML email.
//
// IDENTICAL logic to src/shared/emailTemplate/renderTemplate.ts (the admin preview).
// src/ and api/ are separate TS builds, so the renderer is mirrored here for the send
// path. Keep the two copies in sync.

export type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'fields'; rows: { label: string; value: string }[] }
  | { type: 'button'; label: string; href: string }
  | { type: 'divider' };

export type TemplateData = Record<string, string>;

const escapeHtml = (v: string): string =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const substitute = (text: string, data: TemplateData): string =>
  text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => data[key] ?? '');

const renderText = (raw: string, data: TemplateData): string =>
  escapeHtml(substitute(raw, data));

const safeUrl = (raw: string, data: TemplateData): string => {
  const url = substitute(raw, data).trim();
  return /^https?:\/\//i.test(url) ? url : '';
};

const fieldRow = (label: string, value: string, alt: boolean): string => `
    <tr${alt ? ' style="background:#f8fafc;"' : ''}>
      <td style="padding:12px 16px;color:#64748b;font-weight:600;width:40%;border-bottom:1px solid #e2e8f0;">${label}</td>
      <td style="padding:12px 16px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${value}</td>
    </tr>`;

const renderBlock = (block: EmailBlock, data: TemplateData): string => {
  switch (block.type) {
    case 'heading':
      return `<h2 style="margin:0 0 8px;color:#1a3a5c;font-size:18px;">${renderText(block.text, data)}</h2>`;
    case 'paragraph':
      return `<p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.5;">${renderText(
        block.text,
        data
      ).replace(/\n/g, '<br/>')}</p>`;
    case 'fields': {
      const rows = block.rows
        .map((r, i) => fieldRow(renderText(r.label, data), renderText(r.value, data), i % 2 === 0))
        .join('');
      return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:14px;margin-bottom:24px;">${rows}</table>`;
    }
    case 'button': {
      const href = safeUrl(block.href, data);
      if (!href) return '';
      return `<table cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="background:#1a3a5c;border-radius:6px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">${renderText(
        block.label,
        data
      )}</a>
    </td></tr></table>`;
    }
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>`;
    default:
      return '';
  }
};

/** Substitute placeholders into the subject (plain text — not HTML-escaped). */
export const renderSubject = (subject: string, data: TemplateData): string =>
  substitute(subject, data).trim();

/** Render the full branded HTML email for a set of blocks + data. */
export const renderEmailHtml = (blocks: EmailBlock[], data: TemplateData): string => {
  const inner = blocks.map((b) => renderBlock(b, data)).join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <tr><td style="background:#1a3a5c;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">O3 Corporate Services</h1>
    <p style="margin:4px 0 0;color:#a8c4e0;font-size:13px;">Request Management System</p>
  </td></tr>
  <tr><td style="padding:32px;">
${inner}
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Automated notification from O3 Corporate Services. Please do not reply.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
};

/** Tolerant parse of stored gcp_bodyblocks JSON — [] on bad data. */
export const parseBlocks = (raw: string | null | undefined): EmailBlock[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailBlock[]) : [];
  } catch {
    return [];
  }
};
