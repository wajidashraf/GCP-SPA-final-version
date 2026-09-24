import type { GcpRequest } from '../../types/request';
import {
  buildODataQuery,
  pageSizeHeader,
  powerPagesFetch,
  WebApiError,
} from '../powerPagesApi.ts';
import {
  PBL_BIDDER_SOURCE,
  REQUEST_CHILD_SOURCE_BY_KIND,
} from '../requestChildSources.ts';
import type { RequestChildSource } from '../requestChildSources.ts';
import { buildParentLookupFilter, resolveChildKind } from '../requestIntegrity.ts';

type RequestDeletionStage = 'bidders' | 'child' | 'parent';

type RequestDeletionIo = {
  listIds: (source: RequestChildSource, parentId: string) => Promise<string[]>;
  deleteRecord: (entitySet: string, id: string) => Promise<void>;
  isNotFound: (error: unknown) => boolean;
};

type DeleteRequestResult = {
  deletedBidders: number;
  deletedChildren: number;
  parentDeleted: true;
};

class RequestDeletionError extends Error {
  readonly stage: RequestDeletionStage;
  readonly cause?: unknown;

  constructor(stage: RequestDeletionStage, message: string, cause?: unknown) {
    super(message);
    this.name = 'RequestDeletionError';
    this.stage = stage;
    this.cause = cause;
  }
}

type IdListResponse = {
  value?: Array<Record<string, unknown>>;
  '@odata.nextLink'?: string;
};

const listIds = async (
  source: RequestChildSource,
  parentId: string,
): Promise<string[]> => {
  let url = `/_api/${source.entitySet}${buildODataQuery({
    select: [source.idField],
    filter: buildParentLookupFilter(source.parentField, [parentId]),
  })}`;
  const ids: string[] = [];

  do {
    const response = await powerPagesFetch<IdListResponse>(url, {
      method: 'GET',
      headers: pageSizeHeader(500),
    });
    for (const row of response?.value ?? []) {
      const id = row[source.idField];
      if (typeof id === 'string' && id.trim()) ids.push(id.trim());
    }
    url = response?.['@odata.nextLink'] ?? '';
  } while (url);

  return ids;
};

const defaultIo: RequestDeletionIo = {
  listIds,
  deleteRecord: async (entitySet, id) => {
    await powerPagesFetch<void>(`/_api/${entitySet}(${id})`, {
      method: 'DELETE',
    });
  },
  isNotFound: (error) => error instanceof WebApiError && error.status === 404,
};

const safeDelete = async (
  io: RequestDeletionIo,
  entitySet: string,
  id: string,
): Promise<boolean> => {
  try {
    await io.deleteRecord(entitySet, id);
    return true;
  } catch (error) {
    if (io.isNotFound(error)) return false;
    throw error;
  }
};

const canDeleteRequests = (roles: readonly string[]): boolean =>
  roles.some((role) => role.trim().toLowerCase() === 'administrators');

const deleteRequestTree = async (
  request: Pick<GcpRequest, 'id' | 'soaCode' | 'matter'>,
  io: RequestDeletionIo = defaultIo,
): Promise<DeleteRequestResult> => {
  const requestId = request.id.trim();
  const kind = resolveChildKind(request);
  if (!requestId || !kind) {
    throw new RequestDeletionError(
      'child',
      'This request cannot be deleted because its related request type could not be identified.',
    );
  }

  const source = REQUEST_CHILD_SOURCE_BY_KIND[kind];
  let childIds: string[];
  try {
    childIds = await io.listIds(source, requestId);
  } catch (error) {
    throw new RequestDeletionError(
      'child',
      'The related request data could not be loaded. Nothing was deleted.',
      error,
    );
  }

  let deletedBidders = 0;
  if (kind === 'pbl') {
    try {
      for (const childId of childIds) {
        const bidderIds = await io.listIds(PBL_BIDDER_SOURCE, childId);
        for (const bidderId of bidderIds) {
          if (await safeDelete(io, PBL_BIDDER_SOURCE.entitySet, bidderId)) {
            deletedBidders += 1;
          }
        }
      }
    } catch (error) {
      throw new RequestDeletionError(
        'bidders',
        'Some bidder records may already be deleted. The request was not deleted. Please retry or contact support.',
        error,
      );
    }
  }

  let deletedChildren = 0;
  try {
    for (const childId of childIds) {
      if (await safeDelete(io, source.entitySet, childId)) {
        deletedChildren += 1;
      }
    }
  } catch (error) {
    throw new RequestDeletionError(
      'child',
      'Some related request data may already be deleted. The request was not deleted. Please retry or contact support.',
      error,
    );
  }

  try {
    await safeDelete(io, 'gcp_requests', requestId);
  } catch (error) {
    throw new RequestDeletionError(
      'parent',
      'Related records were deleted, but the request could not be deleted. Please retry or contact support.',
      error,
    );
  }

  return {
    deletedBidders,
    deletedChildren,
    parentDeleted: true,
  };
};

export { canDeleteRequests, deleteRequestTree, RequestDeletionError };
export type {
  DeleteRequestResult,
  RequestDeletionIo,
  RequestDeletionStage,
};
