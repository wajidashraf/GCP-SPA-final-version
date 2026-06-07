import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type DateTimeFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'required' | 'readOnly' | 'size' | 'value'
  > & { value?: string };

/**
 * Single combined date + time picker (`<input type="datetime-local">`).
 * Value is a local-time string in `YYYY-MM-DDTHH:mm` form (no timezone) — the
 * caller is responsible for converting to/from an ISO UTC string when binding
 * to a Dataverse DateTime column.
 */
const DateTimeField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  ...inputProps
}: DateTimeFieldProps) => {
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
      <Form.Control
        {...inputProps}
        type="datetime-local"
        required={isRequired}
        readOnly={isReadOnly}
        plaintext={isReadOnly}
        isInvalid={Boolean(error)}
        className={className}
        aria-describedby={
          [helpText ? `${fieldId}-help` : '', error ? `${fieldId}-error` : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
    </FormField>
  );
};

export default DateTimeField;
export { DateTimeField };
export type { DateTimeFieldProps };
