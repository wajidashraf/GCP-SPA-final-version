// src/shared/services/projectService.ts
// Create, read, and conditional status-update service for gcp_projects.
//
// Power Pages site settings & table permissions for `gcp_projects` must be
// configured (Webapi/gcp_projects/enabled = true, plus a table permission
// granting the calling web role create/read/write).

import {
  buildODataQuery,
  combinePrefer,
  extractRecordId,
  includeFormattedValues,
  odataBind,
  pageSizeHeader,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi.ts';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi.ts';
import {
  DEFAULT_PROJECT_SELECT,
  mapGcpProject,
  PROJECT_STATUS,
} from '../../types/project.ts';
import type {
  CreateGcpProjectInput,
  GcpProject,
  GcpProjectEntity,
} from '../../types/project.ts';

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

type ProjectActivationResult = {
  outcome: 'activated' | 'unchanged';
  project: GcpProject;
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

const activateProjectIfInactive = async (
  id: string,
  initialProject?: GcpProject,
): Promise<ProjectActivationResult> => {
  let project = initialProject ?? (await getProjectById(id));
  if (!project) {
    throw new Error('The related project could not be loaded.');
  }

  if (project.status !== PROJECT_STATUS.Inactive) {
    return { outcome: 'unchanged', project };
  }

  const patchActive = async (etag: string | null): Promise<void> => {
    if (!etag?.trim()) {
      throw new Error(
        'The related project version could not be confirmed. Please reload and try again.',
      );
    }
    await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
      method: 'PATCH',
      json: { gcp_projectstatus: PROJECT_STATUS.Active },
      headers: { 'If-Match': etag },
    });
  };

  try {
    await patchActive(project.etag);
  } catch (error) {
    if ((error as { status?: number })?.status !== 412) throw error;

    project = await getProjectById(id);
    if (!project) {
      throw new Error('The related project could not be loaded after it changed.');
    }
    if (project.status !== PROJECT_STATUS.Inactive) {
      return { outcome: 'unchanged', project };
    }
    await patchActive(project.etag);
  }

  return {
    outcome: 'activated',
    project: {
      ...project,
      status: PROJECT_STATUS.Active,
      etag: null,
    },
  };
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
  activateProjectIfInactive,
  listProjects,
  listActiveProjects,
  ENTITY_SET as PROJECT_ENTITY_SET,
};
export type {
  CreateProjectOptions,
  CreateProjectResult,
  ProjectActivationResult,
  ListProjectsOptions,
  ListProjectsResult,
};
