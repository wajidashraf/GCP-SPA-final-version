// src/shared/services/requestService.ts
// CRUD service for the gcp_request parent table.
//
// Power Pages site settings & table permissions for `gcp_request` must be
// configured (Webapi/gcp_request/enabled = true, Webapi/gcp_request/fields,
// plus a table permission granting the calling web role create/read/write).

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
  DEFAULT_REQUEST_SELECT,
  mapGcpRequest,
} from '../../types/request';
import type {
  CreateGcpRequestInput,
  GcpRequest,
  GcpRequestEntity,
  UpdateGcpRequestInput,
} from '../../types/request';
import type {
  DecisionCodeValue,
  OutcomeValue,
  RequestCategoryValue,
  RequestStatusValue,
} from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type MatterValue = MatterChoice['value'];

const ENTITY_SET = 'gcp_requests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

// ── Lookup bind helpers ─────────────────────────────────────────────────────
type RequestLookupBinds = {
  requestorContactId?: string | null;
  companyAccountId?: string | null;
  projectId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpRequestInput,
  binds: RequestLookupBinds | undefined
): CreateGcpRequestInput => {
  if (!binds) return input;
  const out: CreateGcpRequestInput = { ...input };
  if (isGuid(binds.requestorContactId)) {
    out['gcp_RequestorName@odata.bind'] = odataBind('contacts', binds.requestorContactId);
  }
  if (isGuid(binds.companyAccountId)) {
    out['gcp_Company@odata.bind'] = odataBind('accounts', binds.companyAccountId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  return out;
};

// ── List ────────────────────────────────────────────────────────────────────
type ListRequestsOptions = {
  select?: readonly string[];
  filter?: string;
  orderby?: string;
  pageSize?: number;
  /** Next page cursor URL returned by a previous call (`@odata.nextLink`). */
  nextLink?: string;
  /** Include formatted display labels for option-sets / lookups. */
  withFormattedValues?: boolean;
};

type ListRequestsResult = {
  items: GcpRequest[];
  totalCount?: number;
  nextLink?: string;
};

const listRequests = async (
  options: ListRequestsOptions = {}
): Promise<ListRequestsResult> => {
  const pageSize = options.pageSize ?? 25;

  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const query: ODataQuery = {
      select: options.select ?? DEFAULT_REQUEST_SELECT,
      filter: options.filter,
      orderby: options.orderby ?? 'createdon desc',
      count: true,
    };
    url = `${BASE_URL}${buildODataQuery(query)}`;
  }

  const headers = options.withFormattedValues
    ? combinePrefer(pageSizeHeader(pageSize), includeFormattedValues())
    : pageSizeHeader(pageSize);

  const res = await powerPagesFetch<ODataListResponse<GcpRequestEntity>>(url, {
    method: 'GET',
    headers,
  });

  return {
    items: (res?.value ?? []).map(mapGcpRequest),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
};

// ── Get by ID ───────────────────────────────────────────────────────────────
const getRequestById = async (
  id: string,
  options: { select?: readonly string[]; withFormattedValues?: boolean } = {}
): Promise<GcpRequest | null> => {
  const query: ODataQuery = {
    select: options.select ?? DEFAULT_REQUEST_SELECT,
  };
  const url = `${BASE_URL}(${id})${buildODataQuery(query)}`;
  try {
    const entity = await powerPagesFetch<GcpRequestEntity>(url, {
      method: 'GET',
      headers: options.withFormattedValues ? includeFormattedValues() : undefined,
    });
    return entity ? mapGcpRequest(entity) : null;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return null;
    throw err;
  }
};

// ── Create ──────────────────────────────────────────────────────────────────
type CreateRequestOptions = {
  lookups?: RequestLookupBinds;
};

type CreateRequestResult = {
  id: string;
  record?: GcpRequest;
};

const createRequest = async (
  input: CreateGcpRequestInput,
  options: CreateRequestOptions = {}
): Promise<CreateRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  // Try to parse body (return=representation). Fall back to Location header.
  let entity: GcpRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_requestid) {
    return { id: entity.gcp_requestid, record: mapGcpRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create succeeded but no record ID was returned.');
  }
  // Do NOT read the record back here. The submit flow only needs the new id
  // (it navigates to /requests afterward), and a read-back GET with the full
  // $select can 400 on columns the calling web role can't read — turning a
  // successful create into a spurious "submission failed".
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateRequestOptions = {
  lookups?: RequestLookupBinds;
};

const updateRequest = async (
  id: string,
  input: UpdateGcpRequestInput,
  options: UpdateRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

// ── Verify (status decision + verifier audit fields) ────────────────────────
type VerifyRequestInput = {
  /** Target gcp_requeststatus choice value. */
  status: number;
  /** Free-text verifier comment (stored on gcp_verifier_comment). */
  comment: string;
  /** Contact GUID of the verifier, bound to gcp_Verified_by. */
  verifiedByContactId?: string | null;
};

/** Patch the request with the verifier's status decision, comment and audit stamp. */
const verifyRequest = async (
  id: string,
  input: VerifyRequestInput
): Promise<void> => {
  const body: Record<string, unknown> = {
    gcp_requeststatus: input.status,
    gcp_verifier_comment: input.comment.trim(),
    gcp_verifydate: new Date().toISOString(),
  };
  if (isGuid(input.verifiedByContactId)) {
    body['gcp_Verified_by@odata.bind'] = odataBind('contacts', input.verifiedByContactId);
  }
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

// ── Review (reviewer decision: decision code + status + outcome + comments) ──

/** "Others" matter types (GCPC value 9, GCP value 13) take the FA outcome on Code 1. */
const OTHERS_MATTERS: ReadonlySet<number> = new Set([9, 13]);

type ReviewTargets = {
  status: RequestStatusValue;
  outcome: OutcomeValue;
};

/**
 * Derive the request status + outcome a decision code commits to, per the BRD.
 * See the decision-code mapping table in the review plan. `category`: GCP = 1,
 * GCPC = 2. Returns null for an unknown code.
 */
const deriveReviewTargets = (
  decisionCode: DecisionCodeValue,
  category: RequestCategoryValue | null,
  matter: MatterValue | null,
): ReviewTargets | null => {
  const isOthers = matter != null && OTHERS_MATTERS.has(matter);
  const isGcpc = category === 2;
  switch (decisionCode) {
    case 1: // Proceed → Draft Review; outcome FA (Others) / ACK (GCP) / E (GCPC)
      return {
        status: 4,
        outcome: isOthers ? 1 : isGcpc ? 3 : 2,
      };
    case 2: // Resubmission
      return { status: 16, outcome: 4 };
    case 3: // Non-compliant: NC3 (GCPC) / NC (GCP)
      return { status: 17, outcome: isGcpc ? 6 : 5 };
    case 4: // Non-compliant (no review request, LOA received)
      return { status: 18, outcome: 7 };
    case 5: // Waived (signed Group CEO waiver)
      return { status: 19, outcome: 8 };
    default:
      return null;
  }
};

type ReviewFields = {
  decisionCode: DecisionCodeValue | null;
  reviewerComments: string | null;
  infoAndCriteria: string | null;
};

/**
 * Read the reviewer fields needed to prefill the Review Request form. These
 * columns are outside DEFAULT_REQUEST_SELECT. Resilient: all-null on failure.
 */
const getReviewFields = async (id: string): Promise<ReviewFields> => {
  try {
    const entity = await powerPagesFetch<GcpRequestEntity>(
      `${BASE_URL}(${id})?$select=gcp_decisioncode,gcp_reviewercomments,gcp_infoandcriteriaforreview`,
      { method: 'GET' },
    );
    return {
      decisionCode: (entity?.gcp_decisioncode ?? null) as DecisionCodeValue | null,
      reviewerComments: entity?.gcp_reviewercomments ?? null,
      infoAndCriteria: entity?.gcp_infoandcriteriaforreview ?? null,
    };
  } catch {
    return { decisionCode: null, reviewerComments: null, infoAndCriteria: null };
  }
};

type ReviewRequestInput = {
  decisionCode: DecisionCodeValue;
  status: RequestStatusValue;
  outcome: OutcomeValue;
  /** Serialized reviewer-comment JSON (gcp_reviewercomments). */
  reviewerComments?: string | null;
  /** Editable Info & Criteria text (special matter types only). */
  infoAndCriteria?: string | null;
  /** Contact GUID of the reviewer, bound to gcp_Reviewedby. */
  reviewedByContactId?: string | null;
};

/** Patch the request with the reviewer's decision, status/outcome and audit stamp. */
const reviewRequest = async (
  id: string,
  input: ReviewRequestInput,
): Promise<void> => {
  const body: Record<string, unknown> = {
    gcp_decisioncode: input.decisionCode,
    gcp_requeststatus: input.status,
    gcp_outcome: input.outcome,
    gcp_reviewercomments: input.reviewerComments ?? '',
    gcp_reviewdate: new Date().toISOString(),
  };
  if (input.infoAndCriteria !== undefined) {
    body.gcp_infoandcriteriaforreview = input.infoAndCriteria;
  }
  if (isGuid(input.reviewedByContactId)) {
    body['gcp_Reviewedby@odata.bind'] = odataBind('contacts', input.reviewedByContactId);
  }
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

type SaveReviewDraftInput = {
  decisionCode?: DecisionCodeValue | null;
  reviewerComments?: string | null;
  infoAndCriteria?: string | null;
  reviewedByContactId?: string | null;
};

/** Patch reviewer fields only — does not change request status (used when editing a draft review). */
const saveReviewDraft = async (
  id: string,
  input: SaveReviewDraftInput,
): Promise<void> => {
  const body: Record<string, unknown> = {
    gcp_reviewercomments: input.reviewerComments ?? '',
    gcp_reviewdate: new Date().toISOString(),
  };
  if (input.decisionCode != null) {
    body.gcp_decisioncode = input.decisionCode;
  }
  if (input.infoAndCriteria !== undefined) {
    body.gcp_infoandcriteriaforreview = input.infoAndCriteria;
  }
  if (isGuid(input.reviewedByContactId)) {
    body['gcp_Reviewedby@odata.bind'] = odataBind('contacts', input.reviewedByContactId);
  }
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** Read just the existing verifier comment (to prefill the form). Resilient: null on any failure. */
const getVerifierComment = async (id: string): Promise<string | null> => {
  try {
    const entity = await powerPagesFetch<GcpRequestEntity>(
      `${BASE_URL}(${id})?$select=gcp_verifier_comment`,
      { method: 'GET' }
    );
    return entity?.gcp_verifier_comment ?? null;
  } catch {
    return null;
  }
};

type VerifierInfo = {
  /** Verifier comment text (gcp_verifier_comment). */
  comment: string | null;
  /** Display name of the verifier (gcp_Verified_by lookup). */
  verifiedByName: string | null;
  /** Verification timestamp (gcp_verifydate, ISO). */
  verifyDate: string | null;
  /** Serialized reviewer-comment JSON (gcp_reviewercomments); present after review. */
  reviewerComments: string | null;
  /** Decision code selected by the reviewer (gcp_decisioncode). */
  decisionCode: DecisionCodeValue | null;
  /** Display name of the reviewer (gcp_Reviewedby lookup). */
  reviewedByName: string | null;
};

/**
 * Read the verifier audit fields for the "General Review" section. Resilient:
 * returns all-null on any failure so the page still renders.
 */
const getVerifierInfo = async (id: string): Promise<VerifierInfo> => {
  try {
    const entity = await powerPagesFetch<GcpRequestEntity>(
      `${BASE_URL}(${id})?$select=gcp_verifier_comment,gcp_verifydate,_gcp_verified_by_value,gcp_reviewercomments,gcp_decisioncode,_gcp_reviewedby_value`,
      { method: 'GET', headers: includeFormattedValues() }
    );
    return {
      comment: entity?.gcp_verifier_comment ?? null,
      verifiedByName:
        entity?.['_gcp_verified_by_value@OData.Community.Display.V1.FormattedValue'] ?? null,
      verifyDate: entity?.gcp_verifydate ?? null,
      reviewerComments: entity?.gcp_reviewercomments ?? null,
      decisionCode: (entity?.gcp_decisioncode ?? null) as DecisionCodeValue | null,
      reviewedByName:
        entity?.['_gcp_reviewedby_value@OData.Community.Display.V1.FormattedValue'] ?? null,
    };
  } catch {
    return {
      comment: null,
      verifiedByName: null,
      verifyDate: null,
      reviewerComments: null,
      decisionCode: null,
      reviewedByName: null,
    };
  }
};

/**
 * Poll until the request's status reflects `expected` (Dataverse commits the
 * PATCH asynchronously, so an immediate re-read can be stale). Resolves true
 * once confirmed, false after exhausting retries.
 */
const pollRequestStatus = async (
  id: string,
  expected: number,
  retries = 10,
  delayMs = 300
): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const entity = await powerPagesFetch<GcpRequestEntity>(
        `${BASE_URL}(${id})?$select=gcp_requeststatus`,
        { method: 'GET' }
      );
      if (entity && Number(entity.gcp_requeststatus) === Number(expected)) return true;
    } catch {
      // Ignore transient read errors and keep polling.
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
};

// ── HOC Acceptance (status 6 → 8) ───────────────────────────────────────────

type AcceptReviewInput = {
  /** Which conclusion code the HOC selected. */
  code: '1a' | '1b' | '2' | '3';
  /** Comma-separated exceptions text; only written when code is '1b'. */
  code1bComment?: string;
  /** Target status after acceptance. GCP channel → 9 (Pending Ack), GCPC → 11 (Pending Endorse). Defaults to 8. */
  targetStatus?: number;
};

/** Patch the request with the HOC conclusion code selection and advance to Complete Acceptance (8). */
const acceptReview = async (
  id: string,
  input: AcceptReviewInput,
): Promise<void> => {
  const body: Record<string, unknown> = {
    gcp_reviewconclusioncode1a: input.code === '1a',
    gcp_reviewconclusioncode1b: input.code === '1b',
    gcp_reviewconclusioncode2: input.code === '2',
    gcp_reviewconclusioncode3: input.code === '3',
    gcp_reviewconclusioncode1bcomment: input.code === '1b' ? (input.code1bComment ?? '') : '',
    gcp_acceptancedate: new Date().toISOString().split('T')[0],
    gcp_requeststatus: input.targetStatus ?? 8,
  };
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

// ── Submit Acknowledgement Letter (status 8 → 10, GCP channel) ──────────────

/** Save the acknowledgement letter text and advance the request to ACK (10). */
const submitAckLetter = async (id: string, text: string): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: {
      gcp_acklettertextcontent: text,
      gcp_acknowledgementdate: new Date().toISOString().split('T')[0],
      gcp_requeststatus: 10,
    },
    headers: { 'If-Match': '*' },
  });
};

// ── Submit Endorsement Letter (status 8 → 12, GCPC channel) ─────────────────

/** Save the endorsement letter text and advance the request to Endorsed (12). */
const submitEndorsementLetter = async (id: string, text: string): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: {
      gcp_endorselettertextcontent: text,
      gcp_endorsementdate: new Date().toISOString().split('T')[0],
      gcp_requeststatus: 12,
    },
    headers: { 'If-Match': '*' },
  });
};

export {
  listRequests,
  getRequestById,
  createRequest,
  updateRequest,
  verifyRequest,
  deriveReviewTargets,
  getReviewFields,
  reviewRequest,
  saveReviewDraft,
  getVerifierComment,
  getVerifierInfo,
  pollRequestStatus,
  acceptReview,
  submitAckLetter,
  submitEndorsementLetter,
  ENTITY_SET as REQUEST_ENTITY_SET,
};
export type {
  ListRequestsOptions,
  ListRequestsResult,
  CreateRequestOptions,
  CreateRequestResult,
  UpdateRequestOptions,
  RequestLookupBinds,
  VerifyRequestInput,
  VerifierInfo,
  ReviewTargets,
  ReviewFields,
  ReviewRequestInput,
  AcceptReviewInput,
};
