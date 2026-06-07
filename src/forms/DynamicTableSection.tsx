import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus, SquareX } from 'lucide-react';

type ColumnDef = {
  /** Object key used in the emitted row data. */
  key: string;
  /** Column header label. */
  label: string;
  /** Input placeholder for this column. */
  placeholder?: string;
};

/** Emitted shape: `{ 1: { [colKey]: value }, 2: { ... } }` (1-based row numbers). */
type TableData = Record<number, Record<string, string>>;

interface DynamicTableSectionProps {
  /** Section title shown on the left of the header bar. */
  title: string;
  /** Column definitions — drive both the header row and the inputs per row. */
  columns: ColumnDef[];
  /** Controlled value; also used to pre-fill rows in edit mode. */
  value?: TableData;
  /** Fires after every keystroke and after any add/remove. */
  onChange?: (data: TableData) => void;
  /** Add-button label. Defaults to `Add Row`. */
  addButtonLabel?: string;
  /** Hides add/remove controls and disables all inputs. */
  readOnly?: boolean;
}

type Row = { id: string; cells: Record<string, string> };

const ACCENT = '#2563EB';
const ACCENT_SOFT = '#3B82F6';
const HEADER_BG = '#F1F5F9';
const BORDER = '#E2E8F0';
const MUTED = '#64748B';
const DANGER = '#DC2626';

const ANIM_NAME = 'dts-row-in';
const KEYFRAMES = `@keyframes ${ANIM_NAME}{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}`;

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `r_${Date.now().toString(36)}_${Math.round(Math.random() * 1e9).toString(36)}`;

const emptyRow = (columns: ColumnDef[]): Row => ({
  id: genId(),
  cells: columns.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = '';
    return acc;
  }, {}),
});

const parseRows = (value: TableData | undefined, columns: ColumnDef[]): Row[] => {
  if (!value || Object.keys(value).length === 0) return [emptyRow(columns)];
  return Object.keys(value)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => ({
      id: genId(),
      cells: columns.reduce<Record<string, string>>((acc, c) => {
        acc[c.key] = String(value[k]?.[c.key] ?? '');
        return acc;
      }, {}),
    }));
};

const toData = (rows: Row[], columns: ColumnDef[]): TableData =>
  rows.reduce<TableData>((acc, row, index) => {
    acc[index + 1] = columns.reduce<Record<string, string>>((cells, c) => {
      cells[c.key] = row.cells[c.key] ?? '';
      return cells;
    }, {});
    return acc;
  }, {});

const styles: Record<string, CSSProperties> = {
  card: {
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
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
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${ACCENT}`,
    background: ACCENT,
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    padding: '7px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    background: HEADER_BG,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: `1px solid ${BORDER}`,
    animation: `${ANIM_NAME} 0.22s ease`,
  },
  rowNo: {
    flex: '0 0 32px',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
  },
  cell: {
    flex: 1,
    minWidth: 0,
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
  actionCol: {
    flex: '0 0 64px',
    display: 'flex',
    justifyContent: 'center',
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${DANGER}`,
    background: '#fff',
    color: DANGER,
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
  },
};

const DynamicTableSection = ({
  title,
  columns,
  value,
  onChange,
  addButtonLabel = 'Add Row',
  readOnly = false,
}: DynamicTableSectionProps) => {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState<Row[]>(() => parseRows(value, columns));
  const rows = internal;

  // Re-sync from the controlled value only when its *content* differs from what
  // we currently hold. The parent re-parses JSON into a fresh object reference on
  // every render, so a reference comparison would always re-run parseRows() and
  // regenerate every row id — remounting the inputs and losing focus after each
  // keystroke. Comparing serialized content keeps ids (and focus) stable on a
  // round-trip, while still resyncing on genuine external changes (e.g. edit-mode load).
  useEffect(() => {
    if (!isControlled) return;
    const incoming = JSON.stringify(value ?? {});
    const current = JSON.stringify(toData(internal, columns));
    if (incoming !== current) {
      setInternal(parseRows(value, columns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, value]);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [hoverRemove, setHoverRemove] = useState<string | null>(null);

  const commit = (next: Row[]) => {
    setInternal(next);
    onChange?.(toData(next, columns));
  };

  const handleCellChange = (rowId: string, key: string, next: string) => {
    commit(
      rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [key]: next } } : r
      )
    );
  };

  const handleAdd = () => commit([...rows, emptyRow(columns)]);

  const handleRemove = (rowId: string) => {
    if (rows.length <= 1) return;
    commit(rows.filter((r) => r.id !== rowId));
  };

  const canRemove = !readOnly && rows.length > 1;

  return (
    <div style={styles.card}>
      <style>{KEYFRAMES}</style>

      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {!readOnly ? (
          <button type="button" style={styles.addBtn} onClick={handleAdd}>
            <Plus size={16} aria-hidden="true" />
            {addButtonLabel}
          </button>
        ) : null}
      </div>

      <div style={styles.colHeader}>
        <span style={styles.rowNo}>No</span>
        {columns.map((col) => (
          <span key={col.key} style={styles.cell}>
            {col.label}
          </span>
        ))}
        {!readOnly ? <span style={styles.actionCol}>Action</span> : null}
      </div>

      {rows.map((row, index) => (
        <div
          key={row.id}
          style={{ ...styles.row, ...(index === rows.length - 1 ? { borderBottom: 'none' } : null) }}
        >
          <span style={styles.rowNo}>{index + 1}</span>
          {columns.map((col) => {
            const fieldKey = `${row.id}:${col.key}`;
            const isFocused = focusedKey === fieldKey;
            return (
              <span key={col.key} style={styles.cell}>
                <input
                  type="text"
                  value={row.cells[col.key] ?? ''}
                  placeholder={col.placeholder}
                  disabled={readOnly}
                  aria-label={`${col.label} — row ${index + 1}`}
                  style={{
                    ...styles.input,
                    borderColor: isFocused ? ACCENT_SOFT : BORDER,
                    boxShadow: isFocused ? `0 0 0 3px ${ACCENT_SOFT}33` : 'none',
                    cursor: readOnly ? 'not-allowed' : 'text',
                  }}
                  onFocus={() => setFocusedKey(fieldKey)}
                  onBlur={() => setFocusedKey((k) => (k === fieldKey ? null : k))}
                  onChange={(e) => handleCellChange(row.id, col.key, e.target.value)}
                />
              </span>
            );
          })}

          {!readOnly ? (
            <span style={styles.actionCol}>
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                disabled={!canRemove}
                aria-label={`Remove row ${index + 1}`}
                title={canRemove ? 'Remove row' : 'At least one row is required'}
                onMouseEnter={() => setHoverRemove(row.id)}
                onMouseLeave={() =>
                  setHoverRemove((h) => (h === row.id ? null : h))
                }
                style={{
                  ...styles.removeBtn,
                  opacity: canRemove ? 1 : 0.4,
                  cursor: canRemove ? 'pointer' : 'not-allowed',
                  ...(canRemove && hoverRemove === row.id
                    ? {
                        background: '#FEF2F2',
                        borderColor: DANGER,
                      }
                    : null),
                }}
              >
                <SquareX size={16} aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default DynamicTableSection;
export { DynamicTableSection };
export type { DynamicTableSectionProps, ColumnDef, TableData };
