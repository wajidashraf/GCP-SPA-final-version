import { matterChoices } from '../data/matterChoices.ts';
import type { GcpRequest } from '../types/request';
import type { ChildData } from './hooks/useRequestDetail';

type ChildKind =
  | 'rtp'
  | 'pbl'
  | 'jvp'
  | 'stsp'
  | 'caa'
  | 'pcca'
  | 'pp'
  | 'vap'
  | 'other'
  | 'rpcca'
  | 'rpp'
  | 'ci'
  | 'cpr';

type RequestIntegrityState = 'complete' | 'missing' | 'unknown';

type IntegrityEvidence = {
  queriedKinds: ReadonlySet<ChildKind>;
  failedKinds: ReadonlySet<ChildKind>;
  childParentIds: ReadonlySet<string>;
  pblBidderParentIds: ReadonlySet<string>;
};

const normalizeId = (value: string): string => value.trim().toLowerCase();

const resolveChildKind = (
  request: Pick<GcpRequest, 'soaCode' | 'matter'>,
): ChildKind | null => {
  switch (request.soaCode) {
    case 1:
      return 'rtp';
    case 2:
      return 'pbl';
    case 3:
      return 'jvp';
    case 4:
      return 'stsp';
    case 5:
      return 'caa';
    case 6:
      return 'pcca';
    case 7:
      return 'pp';
    case 8:
      return 'vap';
    case 9:
    case 13:
      return 'other';
    case 10:
      return 'rpcca';
    case 11:
      return 'ci';
    case 12:
      return 'cpr';
    case 14:
      return 'rpp';
    default:
      break;
  }

  const matterCode = matterChoices.find(
    (matter) => matter.value === request.matter,
  )?.code;
  switch (matterCode) {
    case 'RTP':
      return 'rtp';
    case 'PBL':
      return 'pbl';
    case 'JVP':
      return 'jvp';
    case 'ST/SP':
      return 'stsp';
    case 'CAA':
      return 'caa';
    case 'PCCA':
      return 'pcca';
    case 'PP':
      return 'pp';
    case 'VAP':
      return 'vap';
    case 'Others':
      return 'other';
    case 'R-PCCA':
      return 'rpcca';
    case 'R-PP':
      return 'rpp';
    case 'CI':
      return 'ci';
    case 'CPR':
      return 'cpr';
    default:
      return null;
  }
};

const chunkValues = <T>(values: readonly T[], size: number): T[][] => {
  if (size < 1) throw new Error('Chunk size must be at least 1.');
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const buildParentLookupFilter = (
  field: string,
  parentIds: readonly string[],
): string => {
  if (parentIds.length === 0) {
    throw new Error('At least one parent ID is required.');
  }
  return parentIds
    .map((id) => `${field} eq '${normalizeId(id).replace(/'/g, "''")}'`)
    .join(' or ');
};

const classifyRequestIntegrity = (
  request: GcpRequest,
  evidence: IntegrityEvidence,
): RequestIntegrityState => {
  const kind = resolveChildKind(request);
  if (!kind) return 'unknown';
  if (evidence.failedKinds.has(kind) || !evidence.queriedKinds.has(kind)) {
    return 'unknown';
  }

  const requestId = normalizeId(request.id);
  const hasChild = evidence.childParentIds.has(requestId);
  const hasRequiredData =
    kind === 'pbl'
      ? hasChild && evidence.pblBidderParentIds.has(requestId)
      : hasChild;

  if (hasRequiredData) return 'complete';
  return Number(request.status) === 1 ? 'missing' : 'unknown';
};

const hasRequiredAssociatedData = (child: ChildData): boolean => {
  if (child.type === 'unsupported') return false;
  if (child.type === 'pbl') {
    return child.records.length > 0 && child.bidders.length > 0;
  }
  return child.records.length > 0;
};

export {
  buildParentLookupFilter,
  chunkValues,
  classifyRequestIntegrity,
  hasRequiredAssociatedData,
  resolveChildKind,
};
export type {
  ChildKind,
  IntegrityEvidence,
  RequestIntegrityState,
};
