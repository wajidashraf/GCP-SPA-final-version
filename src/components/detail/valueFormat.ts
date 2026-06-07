// src/components/detail/valueFormat.ts
// Display-only formatting helpers for the read-only Request Detail page.
//
// Two concerns live here:
//  1. Scalar formatters (date / datetime / currency / number / percent / bool).
//  2. A parser for the JSON-serialised "repeatable"/"dynamic-table" columns the
//     multi-step forms write into single text columns. Three on-the-wire shapes
//     exist (see src/forms/{RepeatableTextField,DynamicTableSection,DynamicRowFields}):
//       • string[]                              → bullet list
//       • { [label]: string[] }                 → bullet list (RepeatableTextField)
//       • { 1: {col: val}, 2: {...} }           → table  (Dynamic*Fields, row-keyed)

const EMPTY = '—'; // em dash

/** Trim a value to a display string, or null when there's nothing to show. */
const cleanText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
};

/** Title-case a snake/camel/raw object key for use as a column header. */
const prettifyKey = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (iso: string | null | undefined): string => {
  const v = cleanText(iso);
  if (!v) return EMPTY;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const formatDateTime = (iso: string | null | undefined): string => {
  const v = cleanText(iso);
  if (!v) return EMPTY;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString();
};

const formatCurrency = (
  value: number | null | undefined,
  currency = 'MYR'
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `RM ${value.toLocaleString()}`;
  }
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toLocaleString()}%`;
};

const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return EMPTY;
  return value ? 'Yes' : 'No';
};

// ── Structured (JSON-in-a-column) parsing ───────────────────────────────────

type StructuredList = { type: 'list'; items: string[] };
type StructuredTable = {
  type: 'table';
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
};
type StructuredText = { type: 'text'; text: string };
type StructuredEmpty = { type: 'empty' };
type Structured =
  | StructuredList
  | StructuredTable
  | StructuredText
  | StructuredEmpty;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const rowIsEmpty = (row: Record<string, string>): boolean =>
  Object.values(row).every((c) => cleanText(c) === null);

/**
 * Interpret a raw column value (usually a JSON string) into a renderable
 * structure. Non-JSON text falls back to `{ type: 'text' }` so plain
 * multiline/`ntext` columns still display cleanly.
 */
const parseStructured = (raw: unknown): Structured => {
  const text = cleanText(raw);
  if (!text) return { type: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { type: 'text', text };
  }

  // Shape 1 — string[]
  if (Array.isArray(parsed)) {
    const items = parsed.map((e) => cleanText(e)).filter((s): s is string => !!s);
    return items.length ? { type: 'list', items } : { type: 'empty' };
  }

  if (isPlainObject(parsed)) {
    const values = Object.values(parsed);

    // Shape 3 — row-keyed objects: { 1: {col: val}, 2: {...} }
    if (values.length > 0 && values.every(isPlainObject)) {
      const rows = (values as Record<string, unknown>[])
        .map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, cleanText(v) ?? ''])
          )
        )
        .filter((r) => !rowIsEmpty(r));
      if (!rows.length) return { type: 'empty' };
      const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      return {
        type: 'table',
        columns: keys.map((k) => ({ key: k, label: prettifyKey(k) })),
        rows,
      };
    }

    // Shape 2 — { [label]: string[] } (one or more arrays). Flatten arrays to a list.
    if (values.some(Array.isArray)) {
      const items = values
        .filter(Array.isArray)
        .flat()
        .map((e) => cleanText(e))
        .filter((s): s is string => !!s);
      return items.length ? { type: 'list', items } : { type: 'empty' };
    }

    // Fallback — flat key/value object: render as a single-row table.
    const row = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, cleanText(v) ?? ''])
    );
    if (rowIsEmpty(row)) return { type: 'empty' };
    return {
      type: 'table',
      columns: Object.keys(row).map((k) => ({ key: k, label: prettifyKey(k) })),
      rows: [row],
    };
  }

  return { type: 'text', text };
};

export {
  EMPTY,
  cleanText,
  prettifyKey,
  formatDate,
  formatDateTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatBoolean,
  parseStructured,
};
export type { Structured, StructuredList, StructuredTable, StructuredText };
