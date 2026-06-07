import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type DateFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'required' | 'readOnly' | 'size' | 'value'
  > & { value?: string };

const DateField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  ...inputProps
}: DateFieldProps) => {
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
        type="date"
        required={isRequired}
        readOnly={isReadOnly}
        plaintext={isReadOnly}
        isInvalid={Boolean(error)}
        className={className}
      />
    </FormField>
  );
};

export default DateField;
export { DateField };
export type { DateFieldProps };
