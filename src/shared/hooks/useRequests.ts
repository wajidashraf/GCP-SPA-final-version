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

type UseRequestsState = {
  items: GcpRequest[];
  totalCount?: number;
  isLoading: boolean;
  error: string | null;
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
    setIsLoading(true);
    setError(null);
    try {
      const result: ListRequestsResult = await listRequests({
        ...optionsRef.current,
        nextLink: link,
      });
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      setTotalCount(result.totalCount);
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    } finally {
      setIsLoading(false);
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
