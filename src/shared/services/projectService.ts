// src/shared/services/projectService.ts
// Create + read service for the gcp_project Dataverse table.
//
// Power Pages site settings & table permissions for `gcp_project` must be
// configured (Webapi/gcp_project/enabled = true, plus a table permission
// granting the calling web role create/read).

import {
  buildODataQuery,
  combinePrefer,
  extractRecordId,
  includeFormattedValues,
  odataBind,
  pageSizeHeader,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';
import {
  DEFAULT_PROJECT_SELECT,
  mapGcpProject,
  PROJECT_STATUS,
} from '../../types/project';
import type {
  CreateGcpProjectInput,
  GcpProject,
  GcpProjectEntity,
} from '../../types/project';

const ENTITY_SET = 'gcp_projectses';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type CreateProjectOptions = {
  /** GUID of the related account record for the gcp_Company lookup. */
  companyAccountId?: string | null;
};

type CreateProjectResult = {
  id: string;
  record?: GcpProject;
};

const createProject = async (
  input: CreateGcpProjectInput,
  options: CreateProjectOptions = {}
): Promise<CreateProjectResult> => {
  const body: CreateGcpProjectInput = { ...input };
  if (isGuid(options.companyAccountId)) {
    body['gcp_Company@odata.bind'] = odataBind(
      'accounts',
      options.companyAccountId
    );
  }

  console.log('[projectService] createProject body →', body);
  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  }).catch((err) => {
    console.error('[projectService] createProject failed', err);
    throw err;
  });

  let entity: GcpProjectEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpProjectEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_projectsid) {
    return { id: entity.gcp_projectsid, record: mapGcpProject(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create project succeeded but no record ID was returned.');
  }
  return { id };
};

const getProjectById = async (
  id: string,
  options: { select?: readonly string[] } = {}
): Promise<GcpProject | null> => {
  const query: ODataQuery = {
    select: options.select ?? DEFAULT_PROJECT_SELECT,
  };
  const url = `${BASE_URL}(${id})${buildODataQuery(query)}`;
  try {
    const entity = await powerPagesFetch<GcpProjectEntity>(url, {
      method: 'GET',
    });
    return entity ? mapGcpProject(entity) : null;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return null;
    throw err;
  }
};

type ListProjectsOptions = {
  select?: readonly string[];
  filter?: string;
  orderby?: string;
  pageSize?: number;
  nextLink?: string;
  withFormattedValues?: boolean;
};

type ListProjectsResult = {
  items: GcpProject[];
  totalCount?: number;
  nextLink?: string;
};

const listProjects = async (
  options: ListProjectsOptions = {}
): Promise<ListProjectsResult> => {
  const pageSize = options.pageSize ?? 50;
  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const query: ODataQuery = {
      select: options.select ?? DEFAULT_PROJECT_SELECT,
      filter: options.filter,
      orderby: options.orderby ?? 'gcp_projectname asc',
      count: true,
    };
    url = `${BASE_URL}${buildODataQuery(query)}`;
  }

  const headers = options.withFormattedValues
    ? combinePrefer(pageSizeHeader(pageSize), includeFormattedValues())
    : pageSizeHeader(pageSize);

  const res = await powerPagesFetch<ODataListResponse<GcpProjectEntity>>(url, {
    method: 'GET',
    headers,
  });

  return {
    items: (res?.value ?? []).map(mapGcpProject),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
};

const listActiveProjects = (
  options: Omit<ListProjectsOptions, 'filter'> = {}
): Promise<ListProjectsResult> =>
  listProjects({
    ...options,
    filter: `gcp_projectstatus eq ${PROJECT_STATUS.Active}`,
  });

export {
  createProject,
  getProjectById,
  listProjects,
  listActiveProjects,
  ENTITY_SET as PROJECT_ENTITY_SET,
};
export type {
  CreateProjectOptions,
  CreateProjectResult,
  ListProjectsOptions,
  ListProjectsResult,
};
