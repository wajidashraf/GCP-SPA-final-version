import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type TextFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'required' | 'readOnly' | 'size' | 'value'
  > & { value?: string | number };

const TextField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  type = 'text',
  ...inputProps
}: TextFieldProps) => {
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
        type={type}
        required={isRequired}
        readOnly={isReadOnly}
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

export default TextField;
export { TextField };
export type { TextFieldProps };
