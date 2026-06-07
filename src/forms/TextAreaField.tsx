import type { TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type TextAreaFieldProps = BaseFieldProps &
  Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'required' | 'readOnly' | 'value'
  > & { value?: string };

const TextAreaField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps) => {
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
        {...textareaProps}
        as="textarea"
        rows={rows}
        required={isRequired}
        readOnly={isReadOnly}
        plaintext={isReadOnly}
        isInvalid={Boolean(error)}
        className={className}
      />
    </FormField>
  );
};

export default TextAreaField;
export { TextAreaField };
export type { TextAreaFieldProps };
