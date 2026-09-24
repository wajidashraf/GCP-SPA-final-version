import {
  buildParentLookupFilter,
  chunkValues,
  classifyRequestIntegrity,
  resolveChildKind,
} from '../requestIntegrity.ts';
import type { ChildKind, IntegrityEvidence, RequestIntegrityState } from '../requestIntegrity.ts';
import {
  PBL_BIDDER_SOURCE,
  REQUEST_CHILD_SOURCE_BY_KIND,
} from '../requestChildSources.ts';
import type { GcpRequest } from '../../types/request';

type IntegrityLookupRow = Record<string, string | null | undefined>;

type IntegrityLookupQuery = {
  entitySet: string;
  parentField: string;
  parentIds: readonly string[];
  select: readonly string[];
};

type IntegrityRowLoader = (
  query: IntegrityLookupQuery,
) => Promise<IntegrityLookupRow[]>;

const QUERY_CHUNK_SIZE = 20;
const QUERY_PAGE_SIZE = 500;

const normalizeId = (value: string): string => value.trim().toLowerCase();

const loadIntegrityRows: IntegrityRowLoader = async (query) => {
  const {
    buildODataQuery,
    pageSizeHeader,
    powerPagesFetch,
  } = await import('../powerPagesApi.ts');
  type ListResponse = {
    value?: IntegrityLookupRow[];
    '@odata.nextLink'?: string;
  };

  let url = `/_api/${query.entitySet}${buildODataQuery({
    select: query.select,
    filter: buildParentLookupFilter(query.parentField, query.parentIds),
  })}`;
  const rows: IntegrityLookupRow[] = [];

  do {
    const response = await powerPagesFetch<ListResponse>(url, {
      method: 'GET',
      headers: pageSizeHeader(QUERY_PAGE_SIZE),
    });
    rows.push(...(response?.value ?? []));
    url = response?.['@odata.nextLink'] ?? '';
  } while (url);

  return rows;
};

const checkRequestIntegrity = async (
  requests: readonly GcpRequest[],
  loadRows: IntegrityRowLoader = loadIntegrityRows,
): Promise<Map<string, RequestIntegrityState>> => {
  const requestsByKind = new Map<ChildKind, GcpRequest[]>();
  for (const request of requests) {
    const kind = resolveChildKind(request);
    if (!kind) continue;
    const group = requestsByKind.get(kind) ?? [];
    group.push(request);
    requestsByKind.set(kind, group);
  }

  const queriedKinds = new Set<ChildKind>();
  const failedKinds = new Set<ChildKind>();
  const childParentIds = new Set<string>();
  const pblChildToParent = new Map<string, string>();

  await Promise.all(
    [...requestsByKind.entries()].map(async ([kind, group]) => {
      const source = REQUEST_CHILD_SOURCE_BY_KIND[kind];
      try {
        for (const ids of chunkValues(
          group.map((request) => request.id),
          QUERY_CHUNK_SIZE,
        )) {
          const select = [
            source.parentField,
            ...(kind === 'pbl' ? [source.idField] : []),
          ];
          const rows = await loadRows({
            entitySet: source.entitySet,
            parentField: source.parentField,
            parentIds: ids,
            select,
          });
          for (const row of rows) {
            const parentId = row[source.parentField];
            if (!parentId) continue;
            const normalizedParentId = normalizeId(parentId);
            childParentIds.add(normalizedParentId);
            if (kind === 'pbl') {
              const childId = row[source.idField];
              if (childId) {
                pblChildToParent.set(
                  normalizeId(childId),
                  normalizedParentId,
                );
              }
            }
          }
        }
        queriedKinds.add(kind);
      } catch {
        failedKinds.add(kind);
      }
    }),
  );

  const pblBidderParentIds = new Set<string>();
  if (
    requestsByKind.has('pbl') &&
    !failedKinds.has('pbl') &&
    pblChildToParent.size > 0
  ) {
    try {
      for (const childIds of chunkValues(
        [...pblChildToParent.keys()],
        QUERY_CHUNK_SIZE,
      )) {
        const rows = await loadRows({
          entitySet: PBL_BIDDER_SOURCE.entitySet,
          parentField: PBL_BIDDER_SOURCE.parentField,
          parentIds: childIds,
          select: [PBL_BIDDER_SOURCE.parentField],
        });
        for (const row of rows) {
          const childId = row[PBL_BIDDER_SOURCE.parentField];
          if (!childId) continue;
          const parentId = pblChildToParent.get(normalizeId(childId));
          if (parentId) pblBidderParentIds.add(parentId);
        }
      }
    } catch {
      failedKinds.add('pbl');
    }
  }

  const evidence: IntegrityEvidence = {
    queriedKinds,
    failedKinds,
    childParentIds,
    pblBidderParentIds,
  };
  return new Map(
    requests.map((request) => [
      request.id,
      classifyRequestIntegrity(request, evidence),
    ]),
  );
};

export { checkRequestIntegrity };
export type {
  IntegrityLookupQuery,
  IntegrityLookupRow,
  IntegrityRowLoader,
};
