// src/shared/hooks/useRequests.ts
// React hooks for the gcp_request table.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRequestById,
  listRequests,
} from '../services/requestService';
import type {
  ListRequestsOptions,
  ListRequestsResult,
} from '../services/requestService';
import type { GcpRequest } from '../../types/request';
import { checkRequestIntegrity } from '../services/requestIntegrityService';
import type { RequestIntegrityState } from '../requestIntegrity';
import { loadRequestStatuses } from '../engagementBookingApi';
import { refreshRequestListStatuses } from '../requestStatusPresentation';

type UseRequestsState = {
  items: GcpRequest[];
  totalCount?: number;
  isLoading: boolean;
  error: string | null;
  integrityById: ReadonlyMap<string, RequestIntegrityState>;
  isIntegrityLoading: boolean;
  integrityWarning: string | null;
  nextLink?: string;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
};

const useRequests = (options: ListRequestsOptions = {}): UseRequestsState => {
  const [items, setItems] = useState<GcpRequest[]>([]);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [nextLink, setNextLink] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrityById, setIntegrityById] = useState<
    ReadonlyMap<string, RequestIntegrityState>
  >(new Map());
  const [isIntegrityLoading, setIntegrityLoading] = useState(false);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  // Serialize the options object so we re-fetch only when meaningful inputs change.
  const optionsKey = JSON.stringify({
    select: options.select,
    filter: options.filter,
    orderby: options.orderby,
    pageSize: options.pageSize,
    withFormattedValues: options.withFormattedValues,
  });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const load = useCallback(async (append: boolean, link?: string) => {
    const generation = ++loadGeneration.current;
    const isCurrentLoad = () => loadGeneration.current === generation;
    setIsLoading(true);
    setError(null);
    setIntegrityLoading(true);
    setIntegrityWarning(null);
    if (!append) setIntegrityById(new Map());
    if (!append) setItems([]);
    try {
      const result: ListRequestsResult = await listRequests({
        ...optionsRef.current,
        nextLink: link,
      });
      const freshItems = await refreshRequestListStatuses(result.items, loadRequestStatuses);
      if (!isCurrentLoad()) return;
      setItems((prev) => (append ? [...prev, ...freshItems] : freshItems));
      setTotalCount(result.totalCount);
      setNextLink(result.nextLink);

      let checked: Map<string, RequestIntegrityState>;
      try {
        checked = await checkRequestIntegrity(freshItems);
      } catch {
        checked = new Map(
          freshItems.map((request) => [request.id, 'unknown' as const]),
        );
      }
      if (!isCurrentLoad()) return;
      setIntegrityById((previous) => {
        const next = append ? new Map(previous) : new Map<string, RequestIntegrityState>();
        checked.forEach((state, id) => next.set(id, state));
        return next;
      });
      if ([...checked.values()].some((state) => state === 'unknown')) {
        setIntegrityWarning(
          'Some requests were kept read-only because their associated details could not be verified.',
        );
      }
    } catch (err) {
      if (isCurrentLoad()) {
        setError(err instanceof Error ? err.message : 'Failed to load requests.');
      }
    } finally {
      if (isCurrentLoad()) {
        setIsLoading(false);
        setIntegrityLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const loadMore = useCallback(async () => {
    if (!nextLink) return;
    await load(true, nextLink);
  }, [load, nextLink]);

  const refetch = useCallback(async () => {
    await load(false, undefined);
  }, [load]);

  return {
    items,
    totalCount,
    isLoading,
    error,
    integrityById,
    isIntegrityLoading,
    integrityWarning,
    nextLink,
    hasMore: !!nextLink,
    loadMore,
    refetch,
  };
};

type UseRequestState = {
  record: GcpRequest | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const useRequest = (id: string | null | undefined): UseRequestState => {
  const [record, setRecord] = useState<GcpRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setRecord(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const r = await getRequestById(id);
      setRecord(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { record, isLoading, error, refetch: load };
};

export { useRequests, useRequest };
export type { UseRequestsState, UseRequestState };
