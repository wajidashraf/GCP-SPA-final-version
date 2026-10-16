// src/shared/hooks/useRequestDetail.ts
// Orchestrating hook for the read-only Request Detail page. Loads the parent
// gcp_request, then — based on its SOA code — the matching child request rows
// (and, for PBL, the bidders that hang off the PBL request). Child loads are
// isolated: a permission/Web-API failure on the child surfaces as `childError`
// without blanking the parent record.

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { resolveChildKind } from '../requestIntegrity';
import type { ChildKind } from '../requestIntegrity';
import { collectRequestPages } from '../requestHistory';
import type { ListChildOptions, ListChildResult } from '../services/childRequestList';

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

const matterCodeOf = (request: GcpRequest): string | null =>
  matterChoices.find((m) => m.value === request.matter)?.code ?? null;

const loadChild = async (request: GcpRequest): Promise<ChildData> => {
  const kind = resolveChildKind(request);
  const id = request.id;
  const listAll = <T,>(list: (parentId: string, options?: ListChildOptions) => Promise<ListChildResult<T>>, parentId = id) =>
    collectRequestPages((nextLink) => list(parentId, { withFormattedValues: true, nextLink }));

  switch (kind) {
    case 'rtp':
      return { type: 'rtp', records: await listAll(listRtpRequestsByParent) };
    case 'pbl': {
      const records = await listAll(listPblRequestsByParent);
      const bidderLists = await Promise.all(
        records.map((r) =>
          listAll(listBiddersByPblRequest, r.id)
        )
      );
      return { type: 'pbl', records, bidders: bidderLists.flat() };
    }
    case 'jvp':
      return { type: 'jvp', records: await listAll(listJvpRequestsByParent) };
    case 'stsp':
      return { type: 'stsp', records: await listAll(listStspRequestsByParent) };
    case 'caa':
      return { type: 'caa', records: await listAll(listCaaRequestsByParent) };
    case 'pcca':
      return { type: 'pcca', records: await listAll(listPccaRequestsByParent) };
    case 'pp':
      return { type: 'pp', records: await listAll(listPpRequestsByParent) };
    case 'vap':
      return { type: 'vap', records: await listAll(listVapRequestsByParent) };
    case 'other':
      return { type: 'other', records: await listAll(listOtherRequestsByParent) };
    case 'rpcca':
      return { type: 'rpcca', records: await listAll(listRpccaRequestsByParent) };
    case 'rpp':
      return { type: 'rpp', records: await listAll(listRppRequestsByParent) };
    case 'ci':
      return { type: 'ci', records: await listAll(listCiRequestsByParent) };
    case 'cpr':
      return { type: 'cpr', records: await listAll(listCprRequestsByParent) };
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
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const activeId = useRef(id);
  activeId.current = id;

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const isCurrentLoad = () => loadGeneration.current === generation && activeId.current === id;
    setLoadedForId(id ?? null);

    if (!id) {
      setRequest(null);
      setChild(null);
      setIsLoading(false);
      setError(null);
      setChildError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setChildError(null);
    setRequest(null);
    setChild(null);
    try {
      const parent = await getRequestById(id, { withFormattedValues: true });
      if (!isCurrentLoad()) return;
      setRequest(parent);
      if (!parent) return;
      try {
        const loadedChild = await loadChild(parent);
        if (!isCurrentLoad()) return;
        setChild(loadedChild);
      } catch (childErr) {
        if (!isCurrentLoad()) return;
        setChildError(
          childErr instanceof Error
            ? childErr.message
            : 'Failed to load the related detail for this request.'
        );
      }
    } catch (err) {
      if (!isCurrentLoad()) return;
      setError(err instanceof Error ? err.message : 'Failed to load request.');
    } finally {
      if (isCurrentLoad()) {
        setIsLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [load]);

  if (loadedForId !== (id ?? null)) {
    return { request: null, child: null, isLoading: Boolean(id), error: null, childError: null, refetch: load };
  }
  return { request, child, isLoading, error, childError, refetch: load };
};

export { useRequestDetail, resolveChildKind };
export type { UseRequestDetailState, ChildData, ChildKind };
