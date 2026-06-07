// src/components/detail/documentMeta.ts
// Display helpers for rendering stored document links (see shared/documents.ts)
// on the read-only Request Detail page. Keeps the file-card look consistent with
// the upload-time chip in src/forms/FileUpload.tsx.

const MUTED = '#64748B';

// File-type accent colours — mirror EXT_COLORS in FileUpload.tsx, extended with
// the other types the upload Function accepts (images, text formats).
const EXT_COLORS: Record<string, string> = {
  pdf: '#DC2626',
  doc: '#2563EB',
  docx: '#2563EB',
  xls: '#16A34A',
  xlsx: '#16A34A',
  xlsm: '#16A34A',
  csv: '#16A34A',
  txt: '#64748B',
  md: '#64748B',
  markdown: '#64748B',
  jpg: '#7C3AED',
  jpeg: '#7C3AED',
  png: '#7C3AED',
  gif: '#7C3AED',
  webp: '#7C3AED',
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

/** Lower-cased extension without the dot, or '' when there is none. */
const getExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** Accent colour for a file name's type, falling back to muted grey. */
const extColor = (name: string): string => EXT_COLORS[getExt(name)] ?? MUTED;

const isImage = (name: string): boolean => IMAGE_EXTS.has(getExt(name));
const isPdf = (name: string): boolean => getExt(name) === 'pdf';

/**
 * Truncate a file name to `max` characters, preserving the extension at the end:
 *   "a-really-long-report-name.pdf" → "a-really-long-rep….pdf"
 * Names at or under the limit are returned unchanged.
 */
const truncateName = (name: string, max = 25): string => {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : ''; // includes the dot
  const base = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(1, max - ext.length - 1); // -1 for the ellipsis
  return `${base.slice(0, keep)}…${ext}`;
};

// Friendly labels for the form-field keys files are uploaded against
// (see the *_FIELD constants in src/forms/*). Anything not listed falls back to
// a prettified version of the key.
const FIELD_LABELS: Record<string, string> = {
  projectOrgManpowerChart: 'Project Org / Manpower Chart',
  cashflowForecast: 'Cashflow Forecast',
  costStructure: 'Cost Structure / Breakdown',
  contractStructureImage: 'Contract Structure',
};

/** Title-case a camel/snake/raw field key for use as a fallback label. */
const prettifyField = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Human label for a field-level document group. */
const fieldLabel = (field: string): string =>
  FIELD_LABELS[field] ?? prettifyField(field);

export { getExt, extColor, isImage, isPdf, truncateName, fieldLabel };
