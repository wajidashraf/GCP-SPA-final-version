import { useId } from 'react';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type RadioOption = {
  label: string;
  value: string;
  /** Optional secondary line shown under the label. */
  description?: string;
};

type RadioGroupFieldProps = BaseFieldProps & {
  /** Field name shared by every radio in the group. */
  name: string;
  options: readonly RadioOption[];
  /** Controlled selected value (matches an option's `value`). */
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
};

/**
 * Accessible single-select radio group, styled with the shared `.fx-choice`
 * look. Wrapped in `FormField` for consistent label/error/help rendering.
 */
const RadioGroupField = ({
  id,
  name,
  label,
  options,
  value,
  onChange,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
}: RadioGroupFieldProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  void mode;

  return (
    <FormField
      controlId={fieldId}
      label={label}
      isRequired={isRequired}
      error={error}
      helpText={helpText}
    >
      <div
        className="fx-radio-group"
        role="radiogroup"
        aria-label={label}
        aria-invalid={Boolean(error)}
      >
        {options.map((opt) => {
          const optionId = `${fieldId}-${opt.value}`;
          return (
            <label key={opt.value} className="fx-choice" htmlFor={optionId}>
              <input
                type="radio"
                id={optionId}
                name={name}
                value={opt.value}
                checked={value === opt.value}
                disabled={isReadOnly}
                required={isRequired}
                onChange={(e) => onChange?.(e.target.value)}
              />
              <span className="fx-box" aria-hidden="true" />
              <span className="fx-label">
                <span className="fx-label-title">{opt.label}</span>
                {opt.description ? (
                  <span className="fx-label-desc">{opt.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </FormField>
  );
};

export default RadioGroupField;
export { RadioGroupField };
export type { RadioGroupFieldProps, RadioOption };
