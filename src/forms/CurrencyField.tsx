import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import FormField from './FormField';
import type { BaseFieldProps } from './types';

type CurrencyFieldProps = BaseFieldProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'required' | 'readOnly' | 'size' | 'value' | 'onChange' | 'onBlur' | 'inputMode'
  > & {
    /** Current value as a plain numeric string, e.g. "20000.00". */
    value?: string;
    /** Fires with the sanitized string while typing, and the padded string on blur. */
    onChange?: (value: string) => void;
    /** Decimal places to pad to on blur. Default 2. */
    decimals?: number;
  };

/** Keep only digits and a single decimal point (drops any later dots). */
const sanitize = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
};

/**
 * Pad/round a numeric string to `decimals` places (e.g. "20000" → "20000.00",
 * "12345.6" → "12345.60"). Empty stays empty so optional fields aren't forced to
 * "0.00"; non-numeric text is left untouched for the user to correct.
 */
const padDecimals = (raw: string, decimals: number): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const n = Number(trimmed);
  return Number.isFinite(n) ? n.toFixed(decimals) : trimmed;
};

/**
 * Currency amount input. Renders as a text field (native number inputs strip
 * trailing zeros) with a numeric keypad on mobile, and pads the value to a fixed
 * number of decimals on blur. The stored string parses straight back to a number
 * at submit (e.g. Number("20000.00") === 20000).
 */
const CurrencyField = ({
  id,
  label,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
  className,
  value = '',
  onChange,
  decimals = 2,
  ...inputProps
}: CurrencyFieldProps) => {
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
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange?.(sanitize(e.target.value))}
        onBlur={() => onChange?.(padDecimals(value, decimals))}
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

export default CurrencyField;
export { CurrencyField };
export type { CurrencyFieldProps };
