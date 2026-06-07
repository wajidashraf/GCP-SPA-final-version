import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import type { BaseFieldProps } from './types';

type CheckboxFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'required' | 'readOnly'
  >;

const CheckboxField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className = '',
  ...inputProps
}: CheckboxFieldProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  void mode;
  return (
    <Form.Group
      controlId={fieldId}
      className={`mb-3 border rounded p-2 ${className}`}
      style={{ borderColor: 'var(--accent)' }}
    >
      <Form.Check
        {...inputProps}
        type="checkbox"
        required={isRequired}
        disabled={isReadOnly || inputProps.disabled}
        isInvalid={Boolean(error)}
        label={
          <>
            <span className="fw-semibold">{label}</span>
            {isRequired ? (
              <span className="ms-1 text-danger" aria-hidden="true">
                *
              </span>
            ) : null}
          </>
        }
      />
      {helpText && !error ? (
        <Form.Text className="text-muted d-block ms-4">{helpText}</Form.Text>
      ) : null}
      {error ? (
        <div className="invalid-feedback d-block ms-4">{error}</div>
      ) : null}
    </Form.Group>
  );
};

export default CheckboxField;
export { CheckboxField };
export type { CheckboxFieldProps };
