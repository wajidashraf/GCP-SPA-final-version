import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps, SelectOption } from './types';

type SelectFieldProps = BaseFieldProps &
  Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'children' | 'required' | 'placeholder' | 'size'
  > & {
    options: SelectOption[];
    placeholder?: string;
  };

const SelectField = ({
  id,
  label,
  options,
  placeholder = 'Select an option',
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  name,
  value,
  ...selectProps
}: SelectFieldProps) => {
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
      <Form.Select
        {...selectProps}
        name={name}
        value={value ?? ''}
        required={isRequired}
        disabled={isReadOnly || selectProps.disabled}
        isInvalid={Boolean(error)}
        className={className}
        aria-readonly={isReadOnly || undefined}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Form.Select>
      {isReadOnly && name ? (
        <input type="hidden" name={name} value={String(value ?? '')} />
      ) : null}
    </FormField>
  );
};

export default SelectField;
export { SelectField };
export type { SelectFieldProps };
