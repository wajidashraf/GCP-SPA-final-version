type FieldMode = 'new' | 'edit';

type BaseFieldProps = {
  label: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  mode?: FieldMode;
  error?: string;
  helpText?: string;
};

type SelectOption = {
  label: string;
  value: string;
};

export type { BaseFieldProps, FieldMode, SelectOption };
