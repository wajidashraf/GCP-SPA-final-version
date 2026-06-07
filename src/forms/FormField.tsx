import type { ReactNode } from 'react';
import Form from 'react-bootstrap/Form';

type FormFieldProps = {
  controlId: string;
  label: string;
  isRequired?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
};

const FormField = ({
  controlId,
  label,
  isRequired = false,
  error,
  helpText,
  children,
}: FormFieldProps) => {
  return (
    <Form.Group controlId={controlId} className="mb-3">
      <Form.Label className="fw-semibold">
        {label}
        {isRequired ? (
          <span className="ms-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Form.Label>
      {children}
      {helpText && !error ? (
        <Form.Text id={`${controlId}-help`} className="text-muted">
          {helpText}
        </Form.Text>
      ) : null}
      {error ? (
        <Form.Control.Feedback type="invalid" id={`${controlId}-error`} className="d-block">
          {error}
        </Form.Control.Feedback>
      ) : null}
    </Form.Group>
  );
};

export default FormField;
export { FormField };
export type { FormFieldProps };
