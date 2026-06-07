// src/shared/hooks/useRequestDetail.ts
// Orchestrating hook for the read-only Request Detail page. Loads the parent
// gcp_request, then — based on its SOA code — the matching child request rows
// (and, for PBL, the bidders that hang off the PBL request). Child loads are
// isolated: a permission/Web-API failure on the child surfaces as `childError`
// without blanking the parent record.

import { useCallback, useEffect, useState } from 'react';
import { getRequestById } from '../services/requestService';
import { listRtpRequestsByParent } from '../services/rtpRequestService';
import { listPblRequestsByParent } from '../services/pblRequestService';
import { listBiddersByPblRequest } from '../services/pblBidderService';
import { listJvpRequestsByParent } from '../services/jvpRequestService';
import { listStspRequestsByParent } from '../services/stspRequestService';
import { listCaaRequestsByParent } from '../services/caaRequestService';
import { listPccaRequestsByParent } from '../services/pccaRequestService';
import { listPpRequestsByParent } from '../services/ppRequestService';
import { listVapRequestsByParent } from '../services/vapRequestService';
import { listOtherRequestsByParent } from '../services/otherRequestService';
import { listRpccaRequestsByParent } from '../services/rpccaRequestService';
import { listRppRequestsByParent } from '../services/rppRequestService';
import { listCiRequestsByParent } from '../services/ciRequestService';
import { listCprRequestsByParent } from '../services/cprRequestService';
import type { GcpRequest } from '../../types/request';
import type { GcpRtpRequest } from '../../types/rtpRequest';
import type { GcpPblRequest } from '../../types/pblRequest';
import type { GcpPblBidder } from '../../types/pblBidder';
import type { GcpJvpRequest } from '../../types/jvpRequest';
import type { GcpStspRequest } from '../../types/stspRequest';
import type { GcpCaaRequest } from '../../types/caaRequest';
import type { GcpPccaRequest } from '../../types/pccaRequest';
import type { GcpPpRequest } from '../../types/ppRequest';
import type { GcpVapRequest } from '../../types/vapRequest';
import type { GcpOtherRequest } from '../../types/otherRequest';
import type { GcpRpccaRequest } from '../../types/rpccaRequest';
import type { GcpRppRequest } from '../../types/rppRequest';
import type { GcpCiRequest } from '../../types/ciRequest';
import type { GcpCprRequest } from '../../types/cprRequest';
import { matterChoices } from '../../data/matterChoices';

type ChildData =
  | { type: 'rtp'; records: GcpRtpRequest[] }
  | { type: 'pbl'; records: GcpPblRequest[]; bidders: GcpPblBidder[] }
  | { type: 'jvp'; records: GcpJvpRequest[] }
  | { type: 'stsp'; records: GcpStspRequest[] }
  | { type: 'caa'; records: GcpCaaRequest[] }
  | { type: 'pcca'; records: GcpPccaRequest[] }
  | { type: 'pp'; records: GcpPpRequest[] }
  | { type: 'vap'; records: GcpVapRequest[] }
  | { type: 'other'; records: GcpOtherRequest[] }
  | { type: 'rpcca'; records: GcpRpccaRequest[] }
  | { type: 'rpp'; records: GcpRppRequest[] }
  | { type: 'ci'; records: GcpCiRequest[] }
  | { type: 'cpr'; records: GcpCprRequest[] }
  | { type: 'unsupported'; code: string | null };

type ChildKind = ChildData['type'];

type UseRequestDetailState = {
  request: GcpRequest | null;
  child: ChildData | null;
  isLoading: boolean;
  /** Fatal error loading the parent request. */
  error: string | null;
  /** Non-fatal error loading the child detail (parent still renders). */
  childError: string | null;
  refetch: () => Promise<void>;
};

/** Map a parent request's SOA code (falling back to matter code) to a child kind. */
const resolveChildKind = (request: GcpRequest): Exclude<ChildKind, 'unsupported'> | null => {
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
  // Fallback: derive from the matter code when SOA code is absent/unknown.
  const matterCode = matterChoices.find((m) => m.value === request.matter)?.code;
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

const matterCodeOf = (request: GcpRequest): string | null =>
  matterChoices.find((m) => m.value === request.matter)?.code ?? null;

const loadChild = async (request: GcpRequest): Promise<ChildData> => {
  const kind = resolveChildKind(request);
  const opts = { withFormattedValues: true } as const;
  const id = request.id;

  switch (kind) {
    case 'rtp':
      return { type: 'rtp', records: (await listRtpRequestsByParent(id, opts)).items };
    case 'pbl': {
      const records = (await listPblRequestsByParent(id, opts)).items;
      const bidderLists = await Promise.all(
        records.map((r) =>
          listBiddersByPblRequest(r.id, opts)
            .then((res) => res.items)
            .catch(() => [] as GcpPblBidder[])
        )
      );
      return { type: 'pbl', records, bidders: bidderLists.flat() };
    }
    case 'jvp':
      return { type: 'jvp', records: (await listJvpRequestsByParent(id, opts)).items };
    case 'stsp':
      return { type: 'stsp', records: (await listStspRequestsByParent(id, opts)).items };
    case 'caa':
      return { type: 'caa', records: (await listCaaRequestsByParent(id, opts)).items };
    case 'pcca':
      return { type: 'pcca', records: (await listPccaRequestsByParent(id, opts)).items };
    case 'pp':
      return { type: 'pp', records: (await listPpRequestsByParent(id, opts)).items };
    case 'vap':
      return { type: 'vap', records: (await listVapRequestsByParent(id, opts)).items };
    case 'other':
      return { type: 'other', records: (await listOtherRequestsByParent(id, opts)).items };
    case 'rpcca':
      return { type: 'rpcca', records: (await listRpccaRequestsByParent(id, opts)).items };
    case 'rpp':
      return { type: 'rpp', records: (await listRppRequestsByParent(id, opts)).items };
    case 'ci':
      return { type: 'ci', records: (await listCiRequestsByParent(id, opts)).items };
    case 'cpr':
      return { type: 'cpr', records: (await listCprRequestsByParent(id, opts)).items };
    default:
      return { type: 'unsupported', code: matterCodeOf(request) };
  }
};

const useRequestDetail = (id: string | null | undefined): UseRequestDetailState => {
  const [request, setRequest] = useState<GcpRequest | null>(null);
  const [child, setChild] = useState<ChildData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [childError, setChildError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setRequest(null);
      setChild(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setChildError(null);
    setChild(null);
    try {
      const parent = await getRequestById(id, { withFormattedValues: true });
      setRequest(parent);
      if (!parent) return;
      try {
        setChild(await loadChild(parent));
      } catch (childErr) {
        setChildError(
          childErr instanceof Error
            ? childErr.message
            : 'Failed to load the related detail for this request.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { request, child, isLoading, error, childError, refetch: load };
};

export { useRequestDetail, resolveChildKind };
export type { UseRequestDetailState, ChildData, ChildKind };
