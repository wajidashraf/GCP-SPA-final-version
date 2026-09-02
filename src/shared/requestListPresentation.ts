import type { RequestIntegrityState } from './requestIntegrity';

type RequestRowActionMode = 'normal' | 'edit' | 'disabled' | 'loading';

type RequestRowPresentation = {
  displayStatus: string;
  actionMode: RequestRowActionMode;
  isClickable: boolean;
  isDisabled: boolean;
};

const getRequestRowPresentation = (
  statusLabel: string,
  integrity: RequestIntegrityState | undefined,
): RequestRowPresentation => {
  if (integrity == null) {
    return {
      displayStatus: 'Checking details',
      actionMode: 'loading',
      isClickable: false,
      isDisabled: true,
    };
  }
  if (integrity === 'missing') {
    return {
      displayStatus: 'Draft',
      actionMode: 'edit',
      isClickable: false,
      isDisabled: false,
    };
  }
  if (integrity === 'unknown') {
    return {
      displayStatus: 'Unable to verify',
      actionMode: 'disabled',
      isClickable: false,
      isDisabled: true,
    };
  }
  return {
    displayStatus: statusLabel,
    actionMode: 'normal',
    isClickable: true,
    isDisabled: false,
  };
};

export { getRequestRowPresentation };
export type { RequestRowActionMode, RequestRowPresentation };
