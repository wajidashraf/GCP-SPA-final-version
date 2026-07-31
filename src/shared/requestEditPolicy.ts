type EditPurpose = 'standard' | 'resubmission';

type RequestEditActor = {
  contactId: string | null | undefined;
  isAdmin: boolean;
  isReviewer: boolean;
  isVerifier: boolean;
};

type RequestEditCandidate = {
  status: number | null | undefined;
  requestorContactId: string | null | undefined;
};

type EditRequestRenderState = {
  authLoading: boolean;
  requestLoading: boolean;
  routeId: string | null | undefined;
  requestId: string | null | undefined;
};

type EditSubmissionCopy = {
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  toastMessage: string;
};

type RsVerificationFields = {
  gcp_outcome?: 4;
  gcp_lastupdateddate?: null;
};

type ResubmissionFields = {
  gcp_outcome: 4;
  gcp_lastupdateddate: string;
};

const STATUS_NEW = 1;
const STATUS_R = 3;
const STATUS_RS = 16;
const OUTCOME_RS = 4;

const EDITABLE_STATUSES: ReadonlySet<number> = new Set([
  STATUS_NEW,
  STATUS_R,
  STATUS_RS,
]);

const normalizeId = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

const isEditableRequestStatus = (
  status: number | null | undefined,
): boolean => status != null && EDITABLE_STATUSES.has(Number(status));

const isAuthorizedRequestEditor = (
  requestorContactId: string | null | undefined,
  actor: RequestEditActor,
): boolean => {
  if (actor.isAdmin || actor.isReviewer || actor.isVerifier) return true;

  const requestorId = normalizeId(requestorContactId);
  const actorId = normalizeId(actor.contactId);
  return requestorId.length > 0 && requestorId === actorId;
};

const canEditRequest = (
  request: RequestEditCandidate,
  actor: RequestEditActor,
): boolean =>
  isEditableRequestStatus(request.status) &&
  isAuthorizedRequestEditor(request.requestorContactId, actor);

const canRenderEditRequest = ({
  authLoading,
  requestLoading,
  routeId,
  requestId,
}: EditRequestRenderState): boolean => {
  if (authLoading || requestLoading) return false;

  const normalizedRouteId = normalizeId(routeId);
  const normalizedRequestId = normalizeId(requestId);
  return (
    normalizedRouteId.length > 0 &&
    normalizedRouteId === normalizedRequestId
  );
};

const getEditPurpose = (
  status: number | null | undefined,
): EditPurpose | null => {
  if (Number(status) === STATUS_RS) return 'resubmission';
  if (Number(status) === STATUS_NEW || Number(status) === STATUS_R) {
    return 'standard';
  }
  return null;
};

const getEditSubmissionCopy = (
  purpose: EditPurpose,
): EditSubmissionCopy =>
  purpose === 'resubmission'
    ? {
        submitLabel: 'Submit Changes for Re-review',
        successTitle: 'Changes submitted',
        successMessage:
          'Your changes have been submitted for review. Status and outcome remain RS until the reviewer completes the review.',
        toastMessage: 'Changes submitted for re-review.',
      }
    : {
        submitLabel: 'Save Changes',
        successTitle: 'Changes saved',
        successMessage:
          'Your changes have been saved. The request remains in its current workflow stage.',
        toastMessage: 'Changes saved.',
      };

const getRsVerificationFields = (
  status: number,
): RsVerificationFields =>
  Number(status) === STATUS_RS
    ? {
        gcp_outcome: OUTCOME_RS,
        gcp_lastupdateddate: null,
      }
    : {};

const getResubmissionFields = (
  timestamp: string,
): ResubmissionFields => ({
  gcp_outcome: OUTCOME_RS,
  gcp_lastupdateddate: timestamp,
});

export {
  canRenderEditRequest,
  canEditRequest,
  getEditPurpose,
  getEditSubmissionCopy,
  getResubmissionFields,
  getRsVerificationFields,
  isAuthorizedRequestEditor,
  isEditableRequestStatus,
};
export type {
  EditPurpose,
  EditRequestRenderState,
  EditSubmissionCopy,
  RequestEditActor,
  RequestEditCandidate,
  ResubmissionFields,
  RsVerificationFields,
};
