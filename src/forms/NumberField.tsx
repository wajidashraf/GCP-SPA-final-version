import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type NumberFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'required' | 'readOnly' | 'size' | 'value'
  > & { value?: string | number };

const NumberField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  ...inputProps
}: NumberFieldProps) => {
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
        type="number"
        required={isRequired}
        readOnly={isReadOnly}
        plaintext={isReadOnly}
        isInvalid={Boolean(error)}
        className={className}
      />
    </FormField>
  );
};

export default NumberField;
export { NumberField };
export type { NumberFieldProps };
