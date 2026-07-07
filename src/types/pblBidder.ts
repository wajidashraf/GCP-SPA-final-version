// src/types/pblBidder.ts
// TypeScript mirror of the gcp_pblbidders Dataverse table.
// Logical name: gcp_pblbidders  |  Entity set: gcp_pblbidderses
// Primary name: gcp_pblbiddername  |  PK: gcp_pblbiddersid

type GcpPblBidderEntity = {
  '@odata.etag'?: string;
  gcp_pblbiddersid?: string;
  gcp_pblbiddername?: string | null;
  /** Required text column on the table (max 100). */
  gcp_company?: string | null;
  gcp_location?: string | null;
  gcp_person_in_charge?: string | null;
  gcp_piccontactnumber?: string | null;
  gcp_recommendedby?: string | null;
  gcp_sourcesfrom?: string | null;
  gcp_justificationforlt3bidders?: string | null;
  gcp_acknowledgment?: boolean | null;
  /** Sector picklist (gcp_sectorslist) on the bidder row. */
  gcp_sector?: number | null;

  '_gcp_companyname_value'?: string | null;
  '_gcp_pblrequest_value'?: string | null;
};

type CreateGcpPblBidderInput = {
  gcp_pblbiddername?: string | null;
  gcp_company?: string | null;
  gcp_location?: string | null;
  gcp_person_in_charge?: string | null;
  gcp_piccontactnumber?: string | null;
  gcp_recommendedby?: string | null;
  gcp_sourcesfrom?: string | null;
  gcp_justificationforlt3bidders?: string | null;
  gcp_acknowledgment?: boolean | null;
  gcp_sector?: number | null;
  'gcp_CompanyName@odata.bind'?: string;
  'gcp_PBLRequest@odata.bind'?: string;
};

type UpdateGcpPblBidderInput = Partial<CreateGcpPblBidderInput>;

// ── Clean domain type used by the read-only detail UI ───────────────────────
type GcpPblBidder = {
  id: string;
  bidderName: string | null;
  company: string | null;
  location: string | null;
  personInCharge: string | null;
  picContactNumber: string | null;
  recommendedBy: string | null;
  sourcesFrom: string | null;
  justificationForLt3Bidders: string | null;
  acknowledged: boolean | null;
  /** Sector picklist value (gcp_sectorslist); resolve label via sectorChoices. */
  sector: number | null;
  /** FormattedValue label for the related Account (gcp_CompanyName), when present. */
  companyName: string | null;
  companyAccountId: string | null;
  pblRequestId: string | null;
};

const mapGcpPblBidder = (e: GcpPblBidderEntity): GcpPblBidder => ({
  id: e.gcp_pblbiddersid ?? '',
  bidderName: e.gcp_pblbiddername ?? null,
  company: e.gcp_company ?? null,
  location: e.gcp_location ?? null,
  personInCharge: e.gcp_person_in_charge ?? null,
  picContactNumber: e.gcp_piccontactnumber ?? null,
  recommendedBy: e.gcp_recommendedby ?? null,
  sourcesFrom: e.gcp_sourcesfrom ?? null,
  justificationForLt3Bidders: e.gcp_justificationforlt3bidders ?? null,
  acknowledged: e.gcp_acknowledgment ?? null,
  sector: e.gcp_sector ?? null,
  companyName:
    (e as Record<string, unknown>)[
      '_gcp_companyname_value@OData.Community.Display.V1.FormattedValue'
    ] as string | null ?? null,
  companyAccountId: e['_gcp_companyname_value'] ?? null,
  pblRequestId: e['_gcp_pblrequest_value'] ?? null,
});

const DEFAULT_PBL_BIDDER_SELECT: readonly string[] = [
  'gcp_pblbiddersid',
  'gcp_pblbiddername',
  'gcp_company',
  'gcp_location',
  'gcp_person_in_charge',
  'gcp_piccontactnumber',
  'gcp_recommendedby',
  'gcp_sourcesfrom',
  'gcp_justificationforlt3bidders',
  'gcp_acknowledgment',
  'gcp_sector',
  '_gcp_companyname_value',
  '_gcp_pblrequest_value',
];

export { mapGcpPblBidder, DEFAULT_PBL_BIDDER_SELECT };
export type {
  GcpPblBidderEntity,
  CreateGcpPblBidderInput,
  UpdateGcpPblBidderInput,
  GcpPblBidder,
};
