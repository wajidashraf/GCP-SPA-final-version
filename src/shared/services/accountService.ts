// src/shared/services/accountService.ts
// Read-only service for the Dataverse `account` system table.
// Used to resolve the Company lookup on gcp_request / gcp_rtprequest from a
// company code picklist value (gcp_companycode) or by account GUID.
//
// NOTE: Power Pages site settings & table permissions must allow read access
// to the `account` table (Webapi/account/enabled = true,
// Webapi/account/fields = accountid,name,accountnumber,gcp_companycode,
// _parentaccountid_value, plus a table permission granting Read to the
// calling web role).

import {
  buildODataQuery,
  escapeODataString,
  pageSizeHeader,
  powerPagesFetch,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';
import { ACCOUNT_SELECT, mapAccount } from '../../types/account';
import type { Account, AccountEntity } from '../../types/account';

const ENTITY_SET = 'accounts';
const BASE_URL = `/_api/${ENTITY_SET}`;

/**
 * OData filter for company-selection dropdowns: only accounts that have BOTH a
 * `gcp_companycode` and a `gcp_sector` value set. Both are choice columns, so
 * "has a value" is `ne null`. Filtered server-side so it isn't affected by the
 * client page cap.
 */
const ACCOUNTS_WITH_CODE_AND_SECTOR_FILTER =
  'gcp_companycode ne null and gcp_sector ne null';

// ── Get by ID ───────────────────────────────────────────────────────────────
const getAccountById = async (
  id: string,
  options: { select?: readonly string[] } = {}
): Promise<Account | null> => {
  const query: ODataQuery = {
    select: options.select ?? ACCOUNT_SELECT,
  };
  const url = `${BASE_URL}(${id})${buildODataQuery(query)}`;
  try {
    const entity = await powerPagesFetch<AccountEntity>(url, { method: 'GET' });
    return entity ? mapAccount(entity) : null;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return null;
    throw err;
  }
};

// ── Get by company code ─────────────────────────────────────────────────────
/**
 * Resolve an Account by its `gcp_companycode` picklist value.
 *
 * `gcp_companycode` is a custom picklist column on Account (per
 * customizations.xml) whose integer values match
 * `companyCodeChoices` in src/data/companyChoices.ts. We filter on the
 * integer value, not on `accountnumber`.
 *
 * Returns the first matching Account, or null when no match exists.
 */
const getAccountByCompanyCode = async (
  code: number | string
): Promise<Account | null> => {
  // Picklist values are integers; coerce defensively.
  const numeric = typeof code === 'number' ? code : Number(code);
  let filter: string;
  if (Number.isFinite(numeric)) {
    filter = `gcp_companycode eq ${numeric}`;
  } else {
    // Fallback: if a non-numeric value is provided, try accountnumber match.
    filter = `accountnumber eq '${escapeODataString(String(code))}'`;
  }

  const query: ODataQuery = {
    select: ACCOUNT_SELECT,
    filter,
    top: 1,
  };
  const url = `${BASE_URL}${buildODataQuery(query)}`;
  const res = await powerPagesFetch<ODataListResponse<AccountEntity>>(url, {
    method: 'GET',
    headers: pageSizeHeader(1),
  });
  const first = res?.value?.[0];
  return first ? mapAccount(first) : null;
};

// ── List ────────────────────────────────────────────────────────────────────
type ListAccountsOptions = {
  select?: readonly string[];
  filter?: string;
  orderby?: string;
  top?: number;
  pageSize?: number;
  nextLink?: string;
};

type ListAccountsResult = {
  items: Account[];
  totalCount?: number;
  nextLink?: string;
};

const listAccounts = async (
  options: ListAccountsOptions = {}
): Promise<ListAccountsResult> => {
  const pageSize = options.pageSize ?? options.top ?? 50;

  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const query: ODataQuery = {
      select: options.select ?? ACCOUNT_SELECT,
      filter: options.filter,
      orderby: options.orderby ?? 'name asc',
      top: options.top,
      count: true,
    };
    url = `${BASE_URL}${buildODataQuery(query)}`;
  }

  const res = await powerPagesFetch<ODataListResponse<AccountEntity>>(url, {
    method: 'GET',
    headers: pageSizeHeader(pageSize),
  });

  return {
    items: (res?.value ?? []).map(mapAccount),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
};

export {
  getAccountById,
  getAccountByCompanyCode,
  listAccounts,
  ENTITY_SET as ACCOUNT_ENTITY_SET,
  ACCOUNTS_WITH_CODE_AND_SECTOR_FILTER,
};
export type { ListAccountsOptions, ListAccountsResult };
