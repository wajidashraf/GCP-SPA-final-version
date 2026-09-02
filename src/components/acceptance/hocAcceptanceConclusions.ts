type HocAcceptanceCode = '1a' | '2' | '3';

type HocAcceptanceOption = {
  value: HocAcceptanceCode;
  label: string | null;
  description: string;
};

type StoredConclusionFlags = {
  reviewCode1a?: boolean | null;
  reviewCode1b?: boolean | null;
  reviewCode2?: boolean | null;
  reviewCode3?: boolean | null;
};

const UNIFIED_CODE_ONE_STATEMENT =
  'We accept the summary review conclusion code and we agree to incorporate';

const unifiedCodeOneOption: HocAcceptanceOption = {
  value: '1a',
  label: null,
  description: UNIFIED_CODE_ONE_STATEMENT,
};

const remainingCodeOptions: readonly HocAcceptanceOption[] = [
  {
    value: '2',
    label: 'Code 2',
    description:
      'We acknowledge the need to resubmit the document and incorporate your comments.',
  },
  {
    value: '3',
    label: 'Code 3',
    description: 'Acknowledged. We admit the non-compliance.',
  },
];

const getHocAcceptanceOptions = (
  reviewDecisionCode: number | null,
): readonly HocAcceptanceOption[] =>
  reviewDecisionCode === 1 ? [unifiedCodeOneOption] : remainingCodeOptions;

const deriveHocAcceptanceCode = (
  flags: StoredConclusionFlags,
): HocAcceptanceCode | '' => {
  if (flags.reviewCode1a || flags.reviewCode1b) return '1a';
  if (flags.reviewCode2) return '2';
  if (flags.reviewCode3) return '3';
  return '';
};

export {
  UNIFIED_CODE_ONE_STATEMENT,
  deriveHocAcceptanceCode,
  getHocAcceptanceOptions,
};
export type {
  HocAcceptanceCode,
  HocAcceptanceOption,
  StoredConclusionFlags,
};
