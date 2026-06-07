import { useId, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Plus, SquareX } from 'lucide-react';
import type { BaseFieldProps } from './types';

type RepeatableTextFieldProps = BaseFieldProps & {
  /** Optional explicit id; one is generated when omitted. */
  id?: string;
  /**
   * Controlled value. A JSON string holding `{ [label]: string[] }`, suitable
   * for persisting in a single Dataverse text column. Plain `string[]` JSON is
   * also accepted for backwards compatibility.
   */
  value?: string;
  /** Called with the updated JSON string (`{ [label]: string[] }`) on each edit. */
  onChange?: (value: string) => void;
  /** Label for the add button. Defaults to `Add New Point`. */
  addButtonLabel?: string;
  /** Placeholder per row — a string, or a function of the zero-based index. */
  placeholder?: string | ((index: number) => string);
  /** Minimum number of rows always shown (rows can't be removed below this). Defaults to 1. */
  minPoints?: number;
  /** Optional cap on the number of rows. */
  maxPoints?: number;
  className?: string;
};

/** Parse the controlled JSON string into the underlying list of point values. */
const parsePoints = (
  value: string | undefined,
  label: string,
  minPoints: number
): string[] => {
  let points: string[] = [];
  if (value && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        points = parsed.map((entry) => String(entry ?? ''));
      } else if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const forLabel = record[label] ?? Object.values(record)[0];
        if (Array.isArray(forLabel)) {
          points = forLabel.map((entry) => String(entry ?? ''));
        }
      }
    } catch {
      // Leave `points` empty when the stored value isn't valid JSON.
    }
  }
  while (points.length < minPoints) points.push('');
  return points;
};

const RepeatableTextField = ({
  id,
  label,
  value,
  onChange,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  addButtonLabel = 'Add New Point',
  placeholder = (index) => `Enter point ${index + 1}`,
  minPoints = 1,
  maxPoints,
  className,
}: RepeatableTextFieldProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  void mode;

  const isControlled = value !== undefined && onChange !== undefined;
  const [hoverRemove, setHoverRemove] = useState<number | null>(null);
  const [internal, setInternal] = useState<string[]>(() =>
    parsePoints(value, label, minPoints)
  );
  const points = isControlled ? parsePoints(value, label, minPoints) : internal;

  const commit = (next: string[]) => {
    const safe = next.length >= minPoints ? next : [...next, ''];
    if (!isControlled) setInternal(safe);
    onChange?.(JSON.stringify({ [label]: safe }));
  };

  const handleChange = (index: number, next: string) => {
    const updated = [...points];
    updated[index] = next;
    commit(updated);
  };

  const handleAdd = () => {
    if (maxPoints !== undefined && points.length >= maxPoints) return;
    commit([...points, '']);
  };

  const handleRemove = (index: number) => {
    commit(points.filter((_, i) => i !== index));
  };

  const placeholderFor = (index: number) =>
    typeof placeholder === 'function' ? placeholder(index) : placeholder;

  const canAdd =
    !isReadOnly && (maxPoints === undefined || points.length < maxPoints);
  const canRemove = !isReadOnly && points.length > minPoints;

  return (
    <Form.Group controlId={fieldId} className={`mb-3 ${className ?? ''}`.trim()}>
      <div className="border rounded p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Form.Label className="fw-semibold mb-0">
            {label}
            {isRequired ? (
              <span className="ms-1 text-danger" aria-hidden="true">
                *
              </span>
            ) : null}
          </Form.Label>
          {canAdd ? (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleAdd}
              className="d-inline-flex align-items-center gap-1"
            >
              <Plus size={16} aria-hidden="true" />
              {addButtonLabel}
            </Button>
          ) : null}
        </div>

        {points.map((point, index) => (
          <div
            key={index}
            className="d-flex align-items-center gap-2 mb-2"
          >
            <span
              className="text-muted small fw-semibold text-end"
              style={{ minWidth: '1.5rem' }}
              aria-hidden="true"
            >
              {index + 1}.
            </span>
            <Form.Control
              id={`${fieldId}-${index}`}
              value={point}
              placeholder={placeholderFor(index)}
              readOnly={isReadOnly}
              required={isRequired && index === 0}
              isInvalid={Boolean(error)}
              aria-label={`${label} — point ${index + 1}`}
              onChange={(event) => handleChange(index, event.target.value)}
            />
            {canRemove ? (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label={`Remove point ${index + 1}`}
                onMouseEnter={() => setHoverRemove(index)}
                onMouseLeave={() =>
                  setHoverRemove((h) => (h === index ? null : h))
                }
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  border: '1px solid #DC2626',
                  background: hoverRemove === index ? '#FEF2F2' : '#fff',
                  color: '#DC2626',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <SquareX size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}

        {helpText && !error ? (
          <Form.Text id={`${fieldId}-help`} className="text-muted">
            {helpText}
          </Form.Text>
        ) : null}
        {error ? (
          <div id={`${fieldId}-error`} className="invalid-feedback d-block">
            {error}
          </div>
        ) : null}
      </div>
    </Form.Group>
  );
};

export default RepeatableTextField;
export { RepeatableTextField };
export type { RepeatableTextFieldProps };
