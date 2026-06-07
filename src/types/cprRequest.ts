// src/types/cprRequest.ts
// TypeScript mirror of the gcp_cprrequestgcp Dataverse table (display name "CPR
// Request GCP" — Contract Progress Report).
// Logical name: gcp_cprrequestgcp  |  Entity set: gcp_cprrequestgcps
// Primary name: gcp_cprrequestgcp1  |  PK: gcp_cprrequestgcpid
//
// NOTE: the acknowledgement column on THIS table is `gcp_acknowledgementconfirmed`
// (not `gcp_acknowledgement`). This table has no gcp_soacode column (that lives
// on gcp_request).

import type { CprApplicationStatusValue } from '../data/cprChoices';

// ── Raw OData entity (as it comes back from /_api/gcp_cprrequestgcps) ────────
type GcpCprRequestEntity = {
  '@odata.etag'?: string;
  gcp_cprrequestgcpid?: string;
  gcp_cprrequestgcp1?: string | null;
  gcp_projectcode?: string | null;

  // Step 2 — EOT Information
  gcp_eotlatestno?: string | null;
  gcp_eotlatestdate?: string | null;
  gcp_eotnewapplicationdate?: string | null;
  gcp_eotnewcompletiondate?: string | null;
  gcp_statusofneweotapplication?: CprApplicationStatusValue | null;
  gcp_eotnewjustifications?: string | null;

  // Step 3 — VO Information
  gcp_volatestno?: string | null;
  gcp_latestapprovedvocumulativeamount?: number | null;
  gcp_newvoapplicationamount?: number | null;
  gcp_vonewapplicationno?: string | null;
  gcp_vonewapplicationdate?: string | null;
  gcp_statusofnewvoapplication?: CprApplicationStatusValue | null;
  gcp_vonewjustification?: string | null;

  // Step 4 — Claims to Client
  gcp_cumulativeclaimapplicationamounttodate?: number | null;
  gcp_cumulativeclaimcertifiedamounttodate?: number | null;
  gcp_pendingcertifiedamounttodate?: number | null;
  gcp_noofclaimsforpendingcertifiedamount?: number | null;
  gcp_newnetcertifiedamount?: number | null;
  gcp_dateofclaimpendingcertifiedamount?: string | null;

  // Step 5 — Acknowledgement
  gcp_acknowledgementconfirmed?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpCprRequest = {
  id: string;
  name: string | null;
  projectCode: string | null;

  eotLatestNo: string | null;
  eotLatestDate: string | null;
  eotNewApplicationDate: string | null;
  eotNewCompletionDate: string | null;
  eotStatus: CprApplicationStatusValue | null;
  eotNewJustifications: string | null;

  voLatestNo: string | null;
  voLatestApprovedCumulativeAmount: number | null;
  voNewApplicationAmount: number | null;
  voNewApplicationNo: string | null;
  voNewApplicationDate: string | null;
  voStatus: CprApplicationStatusValue | null;
  voNewJustification: string | null;

  cumulativeClaimApplicationAmount: number | null;
  cumulativeClaimCertifiedAmount: number | null;
  pendingCertifiedAmount: number | null;
  noOfClaimsForPendingCertified: number | null;
  newNetCertifiedAmount: number | null;
  dateOfClaimPendingCertified: string | null;

  acknowledged: boolean | null;

  companyId: string | null;
  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
//   gcp_Project → gcp_projectses(<guid>)
//   gcp_Company → accounts(<guid>)
type CreateGcpCprRequestInput = {
  gcp_cprrequestgcp1?: string | null;
  gcp_projectcode?: string | null;

  gcp_eotlatestno?: string | null;
  gcp_eotlatestdate?: string | null;
  gcp_eotnewapplicationdate?: string | null;
  gcp_eotnewcompletiondate?: string | null;
  gcp_statusofneweotapplication?: CprApplicationStatusValue | null;
  gcp_eotnewjustifications?: string | null;

  gcp_volatestno?: string | null;
  gcp_latestapprovedvocumulativeamount?: number | null;
  gcp_newvoapplicationamount?: number | null;
  gcp_vonewapplicationno?: string | null;
  gcp_vonewapplicationdate?: string | null;
  gcp_statusofnewvoapplication?: CprApplicationStatusValue | null;
  gcp_vonewjustification?: string | null;

  gcp_cumulativeclaimapplicationamounttodate?: number | null;
  gcp_cumulativeclaimcertifiedamounttodate?: number | null;
  gcp_pendingcertifiedamounttodate?: number | null;
  gcp_noofclaimsforpendingcertifiedamount?: number | null;
  gcp_newnetcertifiedamount?: number | null;
  gcp_dateofclaimpendingcertifiedamount?: string | null;

  gcp_acknowledgementconfirmed?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

const mapGcpCprRequest = (e: GcpCprRequestEntity): GcpCprRequest => ({
  id: e.gcp_cprrequestgcpid ?? '',
  name: e.gcp_cprrequestgcp1 ?? null,
  projectCode: e.gcp_projectcode ?? null,

  eotLatestNo: e.gcp_eotlatestno ?? null,
  eotLatestDate: e.gcp_eotlatestdate ?? null,
  eotNewApplicationDate: e.gcp_eotnewapplicationdate ?? null,
  eotNewCompletionDate: e.gcp_eotnewcompletiondate ?? null,
  eotStatus: e.gcp_statusofneweotapplication ?? null,
  eotNewJustifications: e.gcp_eotnewjustifications ?? null,

  voLatestNo: e.gcp_volatestno ?? null,
  voLatestApprovedCumulativeAmount: e.gcp_latestapprovedvocumulativeamount ?? null,
  voNewApplicationAmount: e.gcp_newvoapplicationamount ?? null,
  voNewApplicationNo: e.gcp_vonewapplicationno ?? null,
  voNewApplicationDate: e.gcp_vonewapplicationdate ?? null,
  voStatus: e.gcp_statusofnewvoapplication ?? null,
  voNewJustification: e.gcp_vonewjustification ?? null,

  cumulativeClaimApplicationAmount:
    e.gcp_cumulativeclaimapplicationamounttodate ?? null,
  cumulativeClaimCertifiedAmount:
    e.gcp_cumulativeclaimcertifiedamounttodate ?? null,
  pendingCertifiedAmount: e.gcp_pendingcertifiedamounttodate ?? null,
  noOfClaimsForPendingCertified:
    e.gcp_noofclaimsforpendingcertifiedamount ?? null,
  newNetCertifiedAmount: e.gcp_newnetcertifiedamount ?? null,
  dateOfClaimPendingCertified: e.gcp_dateofclaimpendingcertifiedamount ?? null,

  acknowledged: e.gcp_acknowledgementconfirmed ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_CPR_REQUEST_SELECT: readonly string[] = [
  'gcp_cprrequestgcpid',
  'gcp_cprrequestgcp1',
  'gcp_projectcode',
  'gcp_eotlatestno',
  'gcp_eotlatestdate',
  'gcp_eotnewapplicationdate',
  'gcp_eotnewcompletiondate',
  'gcp_statusofneweotapplication',
  'gcp_eotnewjustifications',
  'gcp_volatestno',
  'gcp_latestapprovedvocumulativeamount',
  'gcp_newvoapplicationamount',
  'gcp_vonewapplicationno',
  'gcp_vonewapplicationdate',
  'gcp_statusofnewvoapplication',
  'gcp_vonewjustification',
  'gcp_cumulativeclaimapplicationamounttodate',
  'gcp_cumulativeclaimcertifiedamounttodate',
  'gcp_pendingcertifiedamounttodate',
  'gcp_noofclaimsforpendingcertifiedamount',
  'gcp_newnetcertifiedamount',
  'gcp_dateofclaimpendingcertifiedamount',
  'gcp_acknowledgementconfirmed',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpCprRequest, DEFAULT_CPR_REQUEST_SELECT };
export type { GcpCprRequest, GcpCprRequestEntity, CreateGcpCprRequestInput };
