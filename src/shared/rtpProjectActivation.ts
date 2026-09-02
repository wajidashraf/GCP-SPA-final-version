import type { GcpProject } from '../types/project';

const RTP_MATTER = 1;
const FR_REQUEST_STATUS = 0;

type VerificationActivationInput = {
  matter: number | null | undefined;
  targetStatus: number;
  projectId: string | null | undefined;
  verificationAlreadySaved: boolean;
};

type VerificationActivationDependencies = {
  loadProject: (projectId: string) => Promise<GcpProject | null>;
  verifyRequest: () => Promise<void>;
  confirmRequest: () => Promise<boolean>;
  onVerificationSaved?: () => void;
  activateProject: (
    projectId: string,
    initialProject: GcpProject,
  ) => Promise<unknown>;
};

type VerificationSubmissionPresentation = {
  submitLabel: string;
  errorTitle: string;
  errorPrefix: string;
  progressTitle: string;
  progressMessage: string;
};

const getVerificationSubmissionPresentation = (
  verificationSaved: boolean,
): VerificationSubmissionPresentation =>
  verificationSaved
    ? {
        submitLabel: 'Retry Project Activation',
        errorTitle: 'Verification saved, but project activation failed',
        errorPrefix: 'Failed to activate the related project',
        progressTitle: 'Activating project',
        progressMessage: 'Retrying the related project activation…',
      }
    : {
        submitLabel: 'Submit Verification',
        errorTitle: 'Couldn’t submit',
        errorPrefix: 'Failed to update request',
        progressTitle: 'Updating request',
        progressMessage: 'Saving your decision and confirming the status update…',
      };

const isRtpFrVerification = (
  matter: number | null | undefined,
  targetStatus: number,
): boolean =>
  Number(matter) === RTP_MATTER && Number(targetStatus) === FR_REQUEST_STATUS;

const submitVerificationWithRtpProjectActivation = async (
  input: VerificationActivationInput,
  dependencies: VerificationActivationDependencies,
): Promise<void> => {
  const requiresProjectActivation = isRtpFrVerification(
    input.matter,
    input.targetStatus,
  );

  if (!requiresProjectActivation) {
    await dependencies.verifyRequest();
    await dependencies.confirmRequest();
    return;
  }

  const projectId = input.projectId?.trim();
  if (!projectId) {
    throw new Error(
      'This RTP request has no related project. Verification cannot be submitted as FR.',
    );
  }

  const project = await dependencies.loadProject(projectId);
  if (!project) {
    throw new Error(
      'The related project could not be loaded. Verification cannot be submitted as FR.',
    );
  }

  if (!input.verificationAlreadySaved) {
    await dependencies.verifyRequest();
    const confirmed = await dependencies.confirmRequest();
    if (!confirmed) {
      throw new Error(
        'The verification status could not be confirmed. Please try again.',
      );
    }
    dependencies.onVerificationSaved?.();
  }

  await dependencies.activateProject(projectId, project);
};

export {
  getVerificationSubmissionPresentation,
  isRtpFrVerification,
  submitVerificationWithRtpProjectActivation,
};
export type {
  VerificationActivationDependencies,
  VerificationActivationInput,
  VerificationSubmissionPresentation,
};
