// src/shared/services/signatureService.ts
// CRUD service for the gcp_signatures table.
//
// Power Pages site settings: Webapi/gcp_signature/enabled = true
// Table permissions: Authenticated Users / Admin / Reviewer must have Read;
//   Signatory members must have Create/Read on gcp_signatures.

import {
  buildODataQuery,
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse } from '../powerPagesApi';

const ENTITY_SET = 'gcp_signatures';
const BASE_URL = `/_api/${ENTITY_SET}`;

type GcpSignatureEntity = {
  gcp_signatureid: string;
  gcp_name: string | null;
  gcp_signurl: string | null;
  createdon: string | null;
};

type GcpSignature = {
  id: string;
  signatoryEmail: string | null;
  signUrl: string | null;
  createdOn: string | null;
};

type CreateSignatureInput = {
  requestId: string;
  signatoryEmail: string;
  signatoryContactId: string | null;
  signUrl: string;
};

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

const mapSignature = (e: GcpSignatureEntity): GcpSignature => ({
  id: e.gcp_signatureid,
  signatoryEmail: e.gcp_name ?? null,
  signUrl: e.gcp_signurl ?? null,
  createdOn: e.createdon ?? null,
});

// ── List ────────────────────────────────────────────────────────────────────

const listSignaturesForRequest = async (
  requestId: string,
): Promise<GcpSignature[]> => {
  const query = buildODataQuery({
    select: ['gcp_signatureid', 'gcp_name', 'gcp_signurl', 'createdon'],
    filter: `_gcp_request_value eq ${requestId}`,
    orderby: 'createdon asc',
  });
  const res = await powerPagesFetch<ODataListResponse<GcpSignatureEntity>>(
    `${BASE_URL}${query}`,
    { method: 'GET' },
  );
  return (res?.value ?? []).map(mapSignature);
};

// ── Create ──────────────────────────────────────────────────────────────────

const createSignature = async (
  input: CreateSignatureInput,
): Promise<string> => {
  const body: Record<string, unknown> = {
    // gcp_name stores the signatory email for easy matching on read.
    gcp_name: input.signatoryEmail,
    gcp_signurl: input.signUrl,
    'gcp_Request@odata.bind': odataBind('gcp_requests', input.requestId),
  };
  if (isGuid(input.signatoryContactId)) {
    body['gcp_Signatory@odata.bind'] = odataBind(
      'contacts',
      input.signatoryContactId,
    );
  }
  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
  });
  const id = extractRecordId(res);
  if (!id) throw new Error('Create succeeded but no record ID was returned.');
  return id;
};

// ── Complete Review ─────────────────────────────────────────────────────────
// Moves the request from Pending Review (5) → Complete Review (6).
// Only admin/reviewer roles should call this after signature thresholds are met.

const completeReview = async (requestId: string): Promise<void> => {
  await powerPagesFetch<void>(`/_api/gcp_requests(${requestId})`, {
    method: 'PATCH',
    json: { gcp_requeststatus: 6 },
    headers: { 'If-Match': '*' },
  });
};

export {
  listSignaturesForRequest,
  createSignature,
  completeReview,
  ENTITY_SET as SIGNATURE_ENTITY_SET,
};
export type { GcpSignature, CreateSignatureInput };
