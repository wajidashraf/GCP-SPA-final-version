type DataverseChoice<TValue extends string | number = number> = {
  label: string;
  value: TValue;
};

type SelectOption = {
  label: string;
  value: string;
};

const toSelectOptions = <TValue extends string | number>(
  choices: readonly DataverseChoice<TValue>[]
): SelectOption[] =>
  choices.map((choice) => ({
    label: choice.label,
    value: String(choice.value),
  }));

const getChoiceLabel = <TValue extends string | number>(
  choices: readonly DataverseChoice<TValue>[],
  value: TValue | string
): string | undefined =>
  choices.find((choice) => String(choice.value) === String(value))?.label;

const parseChoiceValue = <TValue extends string | number>(
  choices: readonly DataverseChoice<TValue>[],
  value: string
): TValue | undefined =>
  choices.find((choice) => String(choice.value) === value)?.value;

export { getChoiceLabel, parseChoiceValue, toSelectOptions };
export type { DataverseChoice, SelectOption };
