import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus, SquareX } from 'lucide-react';

type FieldDef = {
  /** Object key used in the emitted row data. */
  key: string;
  /** Placeholder text — doubles as the field's visible label. */
  placeholder?: string;
  /** Flex weight controlling the input's relative width. Defaults to 1. */
  flex?: number;
};

/** Emitted shape: `{ 1: { [fieldKey]: value }, 2: { ... } }` (1-based row numbers). */
type RowFieldsData = Record<number, Record<string, string>>;

interface DynamicRowFieldsProps {
  /** Section title shown bold on the left of the header bar. */
  title: string;
  /** Field definitions — one input per field, in order. */
  fields: FieldDef[];
  /** Pre-filled rows (edit mode). Each entry is keyed by field `key`. */
  initialRows?: Record<string, string>[];
  /** Fires after every keystroke and after any add/remove. */
  onChange?: (data: RowFieldsData) => void;
  /** Add-button label. Defaults to `Add Row`. */
  addButtonLabel?: string;
  /** Minimum rows that must remain (remove disabled at this count). Defaults to 1. */
  minRows?: number;
  /** Hides add/remove controls and disables all inputs. */
  readOnly?: boolean;
}

type Row = { id: string; cells: Record<string, string> };

const ACCENT = '#2563EB';
const ACCENT_SOFT = '#3B82F6';
const BORDER = '#E2E8F0';
const MUTED = '#64748B';
const DANGER = '#DC2626';

const ANIM_NAME = 'drf-row-in';
const KEYFRAMES = `@keyframes ${ANIM_NAME}{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}`;

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `r_${Date.now().toString(36)}_${Math.round(Math.random() * 1e9).toString(36)}`;

const rowFromCells = (
  fields: FieldDef[],
  source?: Record<string, string>
): Row => ({
  id: genId(),
  cells: fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.key] = String(source?.[f.key] ?? '');
    return acc;
  }, {}),
});

const initRows = (
  fields: FieldDef[],
  initialRows: Record<string, string>[] | undefined,
  minRows: number
): Row[] => {
  const seed =
    initialRows && initialRows.length > 0
      ? initialRows.map((r) => rowFromCells(fields, r))
      : [rowFromCells(fields)];
  while (seed.length < minRows) seed.push(rowFromCells(fields));
  return seed;
};

const toData = (rows: Row[], fields: FieldDef[]): RowFieldsData =>
  rows.reduce<RowFieldsData>((acc, row, index) => {
    acc[index + 1] = fields.reduce<Record<string, string>>((cells, f) => {
      cells[f.key] = row.cells[f.key] ?? '';
      return cells;
    }, {});
    return acc;
  }, {});

const styles: Record<string, CSSProperties> = {
  card: {
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${BORDER}`,
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: '#0F172A',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    animation: `${ANIM_NAME} 0.2s ease`,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    fontSize: 14,
    color: '#0F172A',
    background: '#F8FAFC',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
};

const addBtnStyle = (hover: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: `1px solid ${hover ? ACCENT : BORDER}`,
  background: hover ? '#EFF6FF' : '#fff',
  color: hover ? ACCENT : '#0F172A',
  fontWeight: 600,
  fontSize: 13,
  padding: '7px 14px',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
});

const removeBtnStyle = (enabled: boolean, hover: boolean): CSSProperties => ({
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  border: `1px solid ${DANGER}`,
  background: enabled && hover ? '#FEF2F2' : '#fff',
  color: DANGER,
  cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.4,
  padding: 0,
  transition: 'background 0.15s ease',
});

const DynamicRowFields = ({
  title,
  fields,
  initialRows,
  onChange,
  addButtonLabel = 'Add Row',
  minRows = 1,
  readOnly = false,
}: DynamicRowFieldsProps) => {
  const [rows, setRows] = useState<Row[]>(() =>
    initRows(fields, initialRows, minRows)
  );
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [hoverRemove, setHoverRemove] = useState<string | null>(null);
  const [hoverAdd, setHoverAdd] = useState(false);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange?.(toData(next, fields));
  };

  const handleCellChange = (rowId: string, key: string, next: string) => {
    commit(
      rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [key]: next } } : r
      )
    );
  };

  const handleAdd = () => commit([...rows, rowFromCells(fields)]);

  const handleRemove = (rowId: string) => {
    if (rows.length <= minRows) return;
    commit(rows.filter((r) => r.id !== rowId));
  };

  const canRemove = !readOnly && rows.length > minRows;

  return (
    <div style={styles.card}>
      <style>{KEYFRAMES}</style>

      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {!readOnly ? (
          <button
            type="button"
            style={addBtnStyle(hoverAdd)}
            onClick={handleAdd}
            onMouseEnter={() => setHoverAdd(true)}
            onMouseLeave={() => setHoverAdd(false)}
          >
            <Plus size={16} aria-hidden="true" />
            {addButtonLabel}
          </button>
        ) : null}
      </div>

      <div style={styles.body}>
        {rows.map((row, index) => (
          <div key={row.id} style={styles.row}>
            {fields.map((field) => {
              const fieldKey = `${row.id}:${field.key}`;
              const isFocused = focusedKey === fieldKey;
              return (
                <input
                  key={field.key}
                  type="text"
                  value={row.cells[field.key] ?? ''}
                  placeholder={field.placeholder}
                  disabled={readOnly}
                  aria-label={field.placeholder ?? field.key}
                  style={{
                    ...styles.input,
                    flex: field.flex ?? 1,
                    minWidth: 0,
                    borderColor: isFocused ? ACCENT_SOFT : BORDER,
                    boxShadow: isFocused ? `0 0 0 3px ${ACCENT_SOFT}33` : 'none',
                    cursor: readOnly ? 'not-allowed' : 'text',
                  }}
                  onFocus={() => setFocusedKey(fieldKey)}
                  onBlur={() => setFocusedKey((k) => (k === fieldKey ? null : k))}
                  onChange={(e) =>
                    handleCellChange(row.id, field.key, e.target.value)
                  }
                />
              );
            })}

            {!readOnly ? (
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                disabled={!canRemove}
                aria-label={`Remove row ${index + 1}`}
                title={canRemove ? 'Remove row' : `At least ${minRows} row(s) required`}
                onMouseEnter={() => setHoverRemove(row.id)}
                onMouseLeave={() =>
                  setHoverRemove((h) => (h === row.id ? null : h))
                }
                style={removeBtnStyle(canRemove, hoverRemove === row.id)}
              >
                <SquareX size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicRowFields;
export { DynamicRowFields };
export type { DynamicRowFieldsProps, FieldDef, RowFieldsData };
