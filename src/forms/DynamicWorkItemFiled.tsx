import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus, SquareX } from 'lucide-react';

export interface WorkItemRow {
  id: string;
  workDescriptionBQ: string;
  priceRevenuRM: string;
  costRM: string;
  descriptionVO: string;
  revenueVO: string;
  voCostRM: string;
}

interface DynamicWorkItemFiledProps {
  /** Header label shown on the left of the title bar. Defaults to `Work Item`. */
  title?: string;
  /** Seeds the table with existing rows. */
  initialRows?: WorkItemRow[];
  /** Fires after every keystroke and after any add/remove, with the full rows array. */
  onChange?: (rows: WorkItemRow[]) => void;
  /** Hides the add/remove controls and disables all inputs. */
  readOnly?: boolean;
}

type ColumnDef = {
  key: keyof Omit<WorkItemRow, 'id'>;
  label: string;
  /** `'text'` renders a left-aligned text input; `'number'` a right-aligned number input. */
  type: 'text' | 'number';
  /** Flex grow ratio shared by the header cell and matching row cell. */
  flex: number;
};

const COLUMNS: ColumnDef[] = [
  { key: 'workDescriptionBQ', label: 'Work Description (BQ)', type: 'text', flex: 1.4 },
  { key: 'priceRevenuRM', label: 'Price/Revenue (RM)', type: 'number', flex: 1 },
  { key: 'costRM', label: 'Cost (RM)', type: 'number', flex: 1 },
  { key: 'descriptionVO', label: 'Description (VO)', type: 'text', flex: 1.4 },
  { key: 'revenueVO', label: 'Revenue (VO)', type: 'number', flex: 1 },
  { key: 'voCostRM', label: 'VO Cost (RM)', type: 'number', flex: 1 },
];

const ACCENT = '#2563EB';
const ACCENT_SOFT = '#3B82F6';
const HEADER_BG = '#F1F5F9';
const BORDER = '#E2E8F0';
const MUTED = '#64748B';
const DANGER = '#DC2626';

const ANIM_NAME = 'dwif-row-in';
const KEYFRAMES = `@keyframes ${ANIM_NAME}{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}`;
const NO_SPINNER = `.${ANIM_NAME}-num::-webkit-outer-spin-button,.${ANIM_NAME}-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}.${ANIM_NAME}-num{-moz-appearance:textfield;}`;

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `wi_${Date.now().toString(36)}_${Math.round(Math.random() * 1e9).toString(36)}`;

const emptyRow = (): WorkItemRow => ({
  id: genId(),
  workDescriptionBQ: '',
  priceRevenuRM: '',
  costRM: '',
  descriptionVO: '',
  revenueVO: '',
  voCostRM: '',
});

const seedRows = (initialRows: WorkItemRow[] | undefined): WorkItemRow[] =>
  initialRows && initialRows.length > 0 ? initialRows.map((r) => ({ ...r })) : [emptyRow()];

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
  cell: {
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
    flex: '0 0 50px',
    display: 'flex',
    justifyContent: 'center',
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 6,
    background: '#fff',
    padding: 0,
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
  },
};

const DynamicWorkItemFiled = ({
  title = 'Work Item',
  initialRows,
  onChange,
  readOnly = false,
}: DynamicWorkItemFiledProps) => {
  const [rows, setRows] = useState<WorkItemRow[]>(() => seedRows(initialRows));

  // Re-seed when a different initialRows reference is supplied (e.g. edit mode loads).
  const seededRef = useRef(initialRows);
  useEffect(() => {
    if (initialRows !== seededRef.current) {
      seededRef.current = initialRows;
      setRows(seedRows(initialRows));
    }
  }, [initialRows]);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [hoverRemove, setHoverRemove] = useState<string | null>(null);

  const commit = (next: WorkItemRow[]) => {
    setRows(next);
    onChange?.(next);
  };

  const handleCellChange = (rowId: string, key: ColumnDef['key'], next: string) => {
    commit(rows.map((r) => (r.id === rowId ? { ...r, [key]: next } : r)));
  };

  const handleAdd = () => commit([...rows, emptyRow()]);

  const handleRemove = (rowId: string) => {
    if (rows.length <= 1) return;
    commit(rows.filter((r) => r.id !== rowId));
  };

  const canRemove = !readOnly && rows.length > 1;

  return (
    <div style={styles.card}>
      <style>{`${KEYFRAMES}${NO_SPINNER}`}</style>

      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {!readOnly ? (
          <button type="button" style={styles.addBtn} onClick={handleAdd}>
            <Plus size={16} aria-hidden="true" />
            Add Row
          </button>
        ) : null}
      </div>

      <div style={styles.colHeader}>
        {COLUMNS.map((col) => (
          <span key={col.key} style={{ ...styles.cell, flex: col.flex }}>
            {col.label}
          </span>
        ))}
        <span style={styles.actionCol}>Action</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={row.id}
          style={{
            ...styles.row,
            ...(index === rows.length - 1 ? { borderBottom: 'none' } : null),
          }}
        >
          {COLUMNS.map((col) => {
            const fieldKey = `${row.id}:${col.key}`;
            const isFocused = focusedKey === fieldKey;
            const isNumber = col.type === 'number';
            return (
              <span key={col.key} style={{ ...styles.cell, flex: col.flex }}>
                <input
                  type={isNumber ? 'number' : 'text'}
                  className={isNumber ? `${ANIM_NAME}-num` : undefined}
                  value={row[col.key]}
                  placeholder={isNumber ? '0.00' : undefined}
                  disabled={readOnly}
                  aria-label={`${col.label} — row ${index + 1}`}
                  style={{
                    ...styles.input,
                    textAlign: isNumber ? 'right' : 'left',
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

          <span style={styles.actionCol}>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                disabled={!canRemove}
                aria-label={`Remove row ${index + 1}`}
                title={canRemove ? 'Remove row' : 'At least one row is required'}
                onMouseEnter={() => setHoverRemove(row.id)}
                onMouseLeave={() => setHoverRemove((h) => (h === row.id ? null : h))}
                style={{
                  ...styles.removeBtn,
                  border: `1px solid ${canRemove ? DANGER : BORDER}`,
                  color: canRemove ? DANGER : MUTED,
                  cursor: canRemove ? 'pointer' : 'not-allowed',
                  ...(canRemove && hoverRemove === row.id
                    ? { background: '#FEF2F2', borderColor: DANGER }
                    : null),
                }}
              >
                <SquareX size={16} aria-hidden="true" />
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DynamicWorkItemFiled;
export { DynamicWorkItemFiled };
export type { DynamicWorkItemFiledProps };
