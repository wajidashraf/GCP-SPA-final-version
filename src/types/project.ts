// src/types/project.ts
// TypeScript mirror of the gcp_project Dataverse table.
// Logical name: gcp_project | Entity set: gcp_projectses | PK: gcp_projectsid
//
// Used to create a stub project record at RTP submission time so the request
// can reference it via the `gcp_Project` lookup.

type GcpProjectEntity = {
  '@odata.etag'?: string;
  gcp_projectsid?: string;
  gcp_projectname?: string | null;
  gcp_projectcode?: string | null;
  gcp_projectstatus?: number | null;
  '_gcp_company_value'?: string | null;
  '_gcp_company_value@OData.Community.Display.V1.FormattedValue'?: string;
  createdon?: string;
  modifiedon?: string;
};

type GcpProject = {
  id: string;
  name: string | null;
  code: string | null;
  status: number | null;
  companyId: string | null;
  companyName: string | null;
  createdOn?: string;
  modifiedOn?: string;
};

const PROJECT_STATUS = {
  Inactive: 0,
  Active: 1,
  Completed: 2,
} as const;

// Lookups MUST be written via `<NavProperty>@odata.bind`. Navigation property:
//   gcp_Company → accounts(<guid>)
type CreateGcpProjectInput = {
  gcp_projectname?: string | null;
  gcp_projectstatus?: number | null;
  'gcp_Company@odata.bind'?: string;
};

const mapGcpProject = (e: GcpProjectEntity): GcpProject => ({
  id: e.gcp_projectsid ?? '',
  name: e.gcp_projectname ?? null,
  code: e.gcp_projectcode ?? null,
  status: e.gcp_projectstatus ?? null,
  companyId: e['_gcp_company_value'] ?? null,
  companyName:
    e['_gcp_company_value@OData.Community.Display.V1.FormattedValue'] ?? null,
  createdOn: e.createdon,
  modifiedOn: e.modifiedon,
});

const DEFAULT_PROJECT_SELECT: readonly string[] = [
  'gcp_projectsid',
  'gcp_projectname',
  'gcp_projectcode',
  'gcp_projectstatus',
  '_gcp_company_value',
  'createdon',
  'modifiedon',
];

export { mapGcpProject, DEFAULT_PROJECT_SELECT, PROJECT_STATUS };
export type { GcpProject, GcpProjectEntity, CreateGcpProjectInput };
