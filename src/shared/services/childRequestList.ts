// src/shared/services/childRequestList.ts
// Shared "list child rows by parent gcp_request" helper used by every child
// request table service (PBL, JVP, CAA, ST/SP). RTP keeps its own bespoke
// implementation, but the shape returned here is identical.
//
// All child tables relate to the parent via the `gcp_Request` lookup, exposed
// on GET as `_gcp_request_value`. We filter on that to fetch only the rows that
// belong to a single parent request.

import {
  buildODataQuery,
  combinePrefer,
  escapeODataString,
  includeFormattedValues,
  pageSizeHeader,
  powerPagesFetch,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

export type ListChildOptions = {
  select?: readonly string[];
  filter?: string;
  orderby?: string;
  pageSize?: number;
  nextLink?: string;
  withFormattedValues?: boolean;
};

export type ListChildResult<T> = {
  items: T[];
  totalCount?: number;
  nextLink?: string;
};

type ListChildConfig<TEntity, TDomain> = {
  baseUrl: string;
  defaultSelect: readonly string[];
  map: (entity: TEntity) => TDomain;
  /**
   * Lookup `_value` field that points back to the parent gcp_request. Defaults
   * to `_gcp_request_value`; override for tables whose parent lookup uses a
   * different logical name (e.g. gcp_otherrequests → `_gcp_requestlookup_value`).
   */
  parentValueField?: string;
};

/**
 * Build a `listXxxByParent(requestId, options)` function for a child request
 * table. Returns an empty result (never throws) when `requestId` is not a GUID.
 */
export const makeListByParent =
  <TEntity, TDomain>(config: ListChildConfig<TEntity, TDomain>) =>
  async (
    requestId: string,
    options: ListChildOptions = {}
  ): Promise<ListChildResult<TDomain>> => {
    if (!isGuid(requestId)) {
      return { items: [], totalCount: 0 };
    }

    const pageSize = options.pageSize ?? 25;

    let url: string;
    if (options.nextLink) {
      url = options.nextLink;
    } else {
      const parentField = config.parentValueField ?? '_gcp_request_value';
      const parentFilter = `${parentField} eq ${escapeODataString(requestId)}`;
      const filter = options.filter
        ? `(${parentFilter}) and (${options.filter})`
        : parentFilter;
      const query: ODataQuery = {
        select: options.select ?? config.defaultSelect,
        filter,
        orderby: options.orderby ?? 'createdon desc',
        count: true,
      };
      url = `${config.baseUrl}${buildODataQuery(query)}`;
    }

    const headers = options.withFormattedValues
      ? combinePrefer(pageSizeHeader(pageSize), includeFormattedValues())
      : pageSizeHeader(pageSize);

    const res = await powerPagesFetch<ODataListResponse<TEntity>>(url, {
      method: 'GET',
      headers,
    });

    return {
      items: (res?.value ?? []).map(config.map),
      totalCount: res?.['@odata.count'],
      nextLink: res?.['@odata.nextLink'],
    };
  };
