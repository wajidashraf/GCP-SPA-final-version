import { serializeDocuments } from '../shared/documents.ts';
import { checkRequestIntegrity } from '../shared/services/requestIntegrityService.ts';
import type { DocumentLink } from '../shared/documents';
import type { RequestIntegrityState } from '../shared/requestIntegrity';
import type {
  GcpRequest,
  UpdateGcpRequestInput,
} from '../types/request';

type RepairParentState = {
  categoryValue: number;
  matterValue: number;
  projectName: string;
  projectCode?: string;
  projectDescription?: string;
  acknowledged: boolean;
};

type RepairParentOptions = {
  documents: DocumentLink[];
  projectId?: string | null;
};

type IntegrityChecker = (
  requests: readonly GcpRequest[],
) => Promise<Map<string, RequestIntegrityState>>;

type ParentWriteResolution =
  | { mode: 'create' }
  | { mode: 'reuse'; requestId: string };

type PblRepairPath = 'create-child' | 'add-bidders' | 'complete';

const orNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const buildRepairParentPayload = (
  state: RepairParentState,
  documents: DocumentLink[],
): UpdateGcpRequestInput => ({
  gcp_category: state.categoryValue as UpdateGcpRequestInput['gcp_category'],
  gcp_mattertype: state.matterValue as UpdateGcpRequestInput['gcp_mattertype'],
  gcp_project_name: orNull(state.projectName),
  ...(state.projectCode !== undefined
    ? { gcp_projectcode: orNull(state.projectCode) }
    : {}),
  ...(state.projectDescription !== undefined
    ? { gcp_projectdiscription: orNull(state.projectDescription) }
    : {}),
  gcp_acknowledgement: state.acknowledged,
  gcp_documentsurl: serializeDocuments(documents),
});

const resolveParentWrite = (
  existingRequestId: string | null | undefined,
): ParentWriteResolution => {
  const requestId = existingRequestId?.trim();
  return requestId
    ? { mode: 'reuse', requestId }
    : { mode: 'create' };
};

const assertStillMissing = async (
  request: GcpRequest,
  check: IntegrityChecker = checkRequestIntegrity,
): Promise<void> => {
  const state = (await check([request])).get(request.id) ?? 'unknown';
  if (state === 'missing') return;
  if (state === 'complete') {
    throw new Error(
      'The associated detail record already exists. Reload this request before continuing.',
    );
  }
  throw new Error(
    'The associated detail record could not be verified. Reload and try again.',
  );
};

const selectPblRepairPath = ({
  childCount,
  bidderCount,
}: {
  childCount: number;
  bidderCount: number;
}): PblRepairPath => {
  if (childCount === 0) return 'create-child';
  if (bidderCount === 0) return 'add-bidders';
  return 'complete';
};

const updateRepairParent = async (
  requestId: string,
  state: RepairParentState,
  options: RepairParentOptions,
): Promise<void> => {
  const { updateRequest } = await import('../shared/services/requestService.ts');
  await updateRequest(
    requestId,
    buildRepairParentPayload(state, options.documents),
    { lookups: { projectId: options.projectId } },
  );
};

export {
  assertStillMissing,
  buildRepairParentPayload,
  resolveParentWrite,
  selectPblRepairPath,
  updateRepairParent,
};
export type {
  IntegrityChecker,
  ParentWriteResolution,
  PblRepairPath,
  RepairParentOptions,
  RepairParentState,
};
