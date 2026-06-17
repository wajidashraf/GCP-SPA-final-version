import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import FormField from './FormField';
import type { BaseFieldProps, SelectOption } from './types';

type MultiSelectFieldProps = BaseFieldProps & {
  name: string;
  /** Currently selected option values. */
  value: string[];
  /** Called with the next selected values whenever the selection changes. */
  onChange: (next: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Maximum number of selectable options. Once reached, unselected options are disabled. */
  maxSelected?: number;
  /** Shown when the option list is empty. */
  emptyText?: string;
};

/**
 * A dropdown that allows selecting multiple options via checkboxes. Renders a
 * trigger button summarising the current selection; clicking opens a panel of
 * checkable options. Closes on outside click or Escape.
 */
const MultiSelectField = ({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select options',
  maxSelected,
  emptyText = 'No options available.',
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
}: MultiSelectFieldProps & { id?: string }) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  void mode;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedSet = new Set(value);
  const atMax = maxSelected != null && value.length >= maxSelected;

  const toggle = (optValue: string) => {
    if (selectedSet.has(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      if (atMax) return;
      onChange([...value, optValue]);
    }
  };

  const remove = (optValue: string) => onChange(value.filter((v) => v !== optValue));

  const selectedOptions = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is SelectOption => Boolean(o));

  const disabled = isReadOnly || options.length === 0;

  return (
    <FormField
      controlId={fieldId}
      label={label}
      isRequired={isRequired}
      error={error}
      helpText={helpText}
    >
      <div className="ms-field" ref={wrapRef}>
        <button
          type="button"
          id={fieldId}
          className={`ms-trigger${error ? ' is-invalid' : ''}`}
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selectedOptions.length === 0 ? (
            <span className="ms-placeholder">
              {options.length === 0 ? emptyText : placeholder}
            </span>
          ) : (
            <span className="ms-chips">
              {selectedOptions.map((o) => (
                <span className="ms-chip" key={o.value}>
                  {o.label}
                  {!isReadOnly && (
                    <span
                      role="button"
                      tabIndex={-1}
                      className="ms-chip-x"
                      aria-label={`Remove ${o.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(o.value);
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
          <ChevronDown size={16} aria-hidden="true" className="ms-caret" />
        </button>

        {open && options.length > 0 && (
          <ul className="ms-panel" role="listbox" aria-multiselectable="true">
            {options.map((o) => {
              const checked = selectedSet.has(o.value);
              const blocked = !checked && atMax;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={`ms-option${checked ? ' is-checked' : ''}`}
                    onClick={() => toggle(o.value)}
                    disabled={blocked}
                  >
                    <span className={`ms-checkbox${checked ? ' is-checked' : ''}`}>
                      {checked && <Check size={12} aria-hidden="true" />}
                    </span>
                    {o.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Hidden inputs keep the selection submittable in a native form. */}
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </FormField>
  );
};

export default MultiSelectField;
export { MultiSelectField };
export type { MultiSelectFieldProps };
