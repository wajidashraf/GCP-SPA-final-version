// src/shared/hooks/useRtpRequest.ts
// React hooks for fetching gcp_rtprequest rows.
//
// - useRtpRequest(id)              — single RTP row by GUID
// - useRtpRequestByParent(reqId)   — first RTP row that belongs to a parent gcp_request

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getRtpRequestById,
  listRtpRequestsByParent,
} from '../services/rtpRequestService';
import type { GcpRtpRequest } from '../../types/rtpRequest';

type UseRtpRequestState = {
  data: GcpRtpRequest | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Failed to load RTP request.';

/** Fetch a single RTP request by its gcp_rtprequestid. */
const useRtpRequest = (id: string | null | undefined): UseRtpRequestState => {
  const [data, setData] = useState<GcpRtpRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    const ticket = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const record = await getRtpRequestById(id);
      if (ticket === seq.current) setData(record);
    } catch (e) {
      if (ticket === seq.current) setError(errorMessage(e));
    } finally {
      if (ticket === seq.current) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
};

/**
 * Fetch the (first) RTP request row tied to a parent gcp_request id. Useful
 * after creating a parent request and needing to display the freshly-bound
 * child without knowing its GUID up front. Returns null if no row exists yet.
 */
const useRtpRequestByParent = (
  parentRequestId: string | null | undefined
): UseRtpRequestState => {
  const [data, setData] = useState<GcpRtpRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(parentRequestId));
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!parentRequestId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    const ticket = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await listRtpRequestsByParent(parentRequestId, { pageSize: 1 });
      if (ticket === seq.current) setData(res.items[0] ?? null);
    } catch (e) {
      if (ticket === seq.current) setError(errorMessage(e));
    } finally {
      if (ticket === seq.current) setIsLoading(false);
    }
  }, [parentRequestId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
};

export { useRtpRequest, useRtpRequestByParent };
export type { UseRtpRequestState };
