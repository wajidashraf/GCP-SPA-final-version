const ENDORSEMENT_ROUTE_ROLES = ['Administrators', 'Endorser'] as const;

type EndorsementActor = {
  isAdmin: boolean;
  isEndorser: boolean;
};

type EndorsementSubmissionDependencies = {
  submit: () => Promise<void>;
  confirm: () => Promise<boolean>;
};

const isEndorsementSourceStatus = (
  status: number | null | undefined,
): boolean => Number(status) === 11 || Number(status) === 8;

const canSubmitEndorsement = (
  status: number | null | undefined,
  actor: EndorsementActor,
): boolean =>
  isEndorsementSourceStatus(status) &&
  (actor.isAdmin || actor.isEndorser);

const errorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null;
  }
  const status = Number(error.status);
  return Number.isFinite(status) ? status : null;
};

const isUncertainSubmissionError = (error: unknown): boolean => {
  const status = errorStatus(error);
  return status == null || status === 429 || status >= 500;
};

const submitEndorsementWithReconciliation = async ({
  submit,
  confirm,
}: EndorsementSubmissionDependencies): Promise<'submitted' | 'reconciled'> => {
  try {
    await submit();
    return 'submitted';
  } catch (error) {
    if (!isUncertainSubmissionError(error) || !(await confirm())) {
      throw error;
    }
    return 'reconciled';
  }
};

const formatEndorsementSubmissionError = (error: unknown): string => {
  const status = errorStatus(error);
  if (status === 401) {
    return 'Your session expired. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to submit this endorsement (HTTP 403).';
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return 'The endorsement could not be submitted. Please try again.';
};

export {
  ENDORSEMENT_ROUTE_ROLES,
  canSubmitEndorsement,
  formatEndorsementSubmissionError,
  isEndorsementSourceStatus,
  submitEndorsementWithReconciliation,
};
export type { EndorsementActor, EndorsementSubmissionDependencies };
