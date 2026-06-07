// src/shared/hooks/useAccount.ts
// React hooks for the Dataverse `account` system table (read-only).
//
// - useAccountByCompanyCode(code): resolves a company-code picklist value
//   (number) to an Account, so the RTP / GCP request form can bind the
//   gcp_Company lookup to the correct account GUID.
// - useAccounts({ filter, top, ... }): admin / lookup list of accounts.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAccountByCompanyCode,
  listAccounts,
} from '../services/accountService';
import type {
  ListAccountsOptions,
  ListAccountsResult,
} from '../services/accountService';
import type { Account } from '../../types/account';

// ── useAccountByCompanyCode ─────────────────────────────────────────────────
type UseAccountByCompanyCodeState = {
  account: Account | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const useAccountByCompanyCode = (
  code: number | string | null | undefined
): UseAccountByCompanyCodeState => {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (code === null || code === undefined || code === '') {
      setAccount(null);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const a = await getAccountByCompanyCode(code);
      setAccount(a);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to resolve company account.'
      );
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  return { account, isLoading, error, refetch: load };
};

// ── useAccounts ─────────────────────────────────────────────────────────────
type UseAccountsState = {
  items: Account[];
  totalCount?: number;
  isLoading: boolean;
  error: string | null;
  nextLink?: string;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
};

const useAccounts = (options: ListAccountsOptions = {}): UseAccountsState => {
  const [items, setItems] = useState<Account[]>([]);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [nextLink, setNextLink] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsKey = JSON.stringify({
    select: options.select,
    filter: options.filter,
    orderby: options.orderby,
    top: options.top,
    pageSize: options.pageSize,
  });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const load = useCallback(async (append: boolean, link?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result: ListAccountsResult = await listAccounts({
        ...optionsRef.current,
        nextLink: link,
      });
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      setTotalCount(result.totalCount);
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
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

export { useAccountByCompanyCode, useAccounts };
export type { UseAccountByCompanyCodeState, UseAccountsState };
