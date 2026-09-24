// src/shared/services/signatureService.ts
// CRUD service for the gcp_signatures table.
//
// Power Pages site settings: Webapi/gcp_signature/enabled = true
// Table permissions: Authenticated users may read signatures. Configured
// signatories may create through the Working GCPC, Reviewer, Verifier, or
// Administrators web roles; the UI also matches the signed-in email to the
// configured signatory member before offering the signing action.

import {
  buildODataQuery,
  escapeODataString,
  extractRecordId,
  includeFormattedValues,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi.ts';
import type { ODataListResponse } from '../powerPagesApi.ts';

const ENTITY_SET = 'gcp_signatures';
const BASE_URL = `/_api/${ENTITY_SET}`;

type GcpSignatureEntity = {
  gcp_signatureid: string;
  gcp_name: string | null;
  gcp_signurl: string | null;
  createdon: string | null;
  _gcp_signatory_value?: string | null;
  _gcp_request_value?: string | null;
  '_gcp_signatory_value@OData.Community.Display.V1.FormattedValue'?: string | null;
};

type GcpSignature = {
  id: string;
  requestId: string | null;
  signatoryEmail: string | null;
  signatoryContactId: string | null;
  signatoryName: string | null;
  signUrl: string | null;
  createdOn: string | null;
};

type CreateSignatureInput = {
  requestId: string;
  signatoryEmail: string;
  signatoryContactId: string | null;
  signUrl: string;
};

type ReusableSignatureInput = {
  requestId: string;
  signatoryEmail: string;
  signatoryContactId: string | null;
};

type ConfirmReusableSignatureResult = {
  signatureId: string | null;
  alreadySigned: boolean;
};

type SignatureBoxState = 'signed' | 'reusable' | 'empty';

type SignatureConfirmationIo = {
  listForRequest: (requestId: string) => Promise<GcpSignature[]>;
  create: (input: CreateSignatureInput) => Promise<string>;
};

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

const normalizeSignatoryEmail = (email: string): string =>
  email.trim().toLowerCase();

type ResolvedSignatureIdentity = {
  kind: 'email' | 'hoc';
  storageKey: string;
  contactId: string | null;
};

const resolveSignatureIdentity = (
  signatoryEmail: string,
  signatoryContactId: string | null,
): ResolvedSignatureIdentity => {
  const normalized = normalizeSignatoryEmail(signatoryEmail);
  if (normalized === 'hoc') {
    if (!isGuid(signatoryContactId)) {
      throw new Error('A valid signatory contact ID is required for HOC signatures.');
    }
    return {
      kind: 'hoc',
      storageKey: 'HOC',
      contactId: signatoryContactId,
    };
  }
  if (!normalized.includes('@')) {
    throw new Error('A valid signatory email is required.');
  }
  return {
    kind: 'email',
    storageKey: normalized,
    contactId: isGuid(signatoryContactId) ? signatoryContactId : null,
  };
};

const mapSignature = (e: GcpSignatureEntity): GcpSignature => ({
  id: e.gcp_signatureid,
  requestId: e._gcp_request_value ?? null,
  signatoryEmail: e.gcp_name ?? null,
  signatoryContactId: e._gcp_signatory_value ?? null,
  signatoryName:
    e['_gcp_signatory_value@OData.Community.Display.V1.FormattedValue'] ?? null,
  signUrl: e.gcp_signurl ?? null,
  createdOn: e.createdon ?? null,
});

const isUsableSignature = (
  signature: GcpSignature | null | undefined,
): signature is GcpSignature & { signUrl: string } =>
  Boolean(signature?.signUrl?.trim());

const findLatestUsableSignature = (
  signatures: readonly GcpSignature[],
): GcpSignature | null => signatures.find(isUsableSignature) ?? null;

const getSignatureBoxState = (
  currentSignature: GcpSignature | undefined,
  reusableSignature: GcpSignature | null,
): SignatureBoxState => {
  if (isUsableSignature(currentSignature)) return 'signed';
  if (isUsableSignature(reusableSignature)) return 'reusable';
  return 'empty';
};

const SIGNATURE_SELECT = [
  'gcp_signatureid',
  'gcp_name',
  'gcp_signurl',
  'createdon',
  '_gcp_signatory_value',
  '_gcp_request_value',
] as const;

const buildLatestReusableSignatureQuery = (
  input: ReusableSignatureInput,
): string => {
  if (!isGuid(input.requestId)) {
    throw new Error('A valid request ID is required.');
  }
  const identity = resolveSignatureIdentity(
    input.signatoryEmail,
    input.signatoryContactId,
  );
  const escapedKey = escapeODataString(identity.storageKey);
  const identityFilter = identity.kind === 'hoc'
    ? `(_gcp_signatory_value eq ${identity.contactId} and gcp_name eq '${escapedKey}')`
    : identity.contactId
      ? `((_gcp_signatory_value eq ${identity.contactId}) or (_gcp_signatory_value eq null and gcp_name eq '${escapedKey}'))`
      : `gcp_name eq '${escapedKey}'`;

  return buildODataQuery({
    select: SIGNATURE_SELECT,
    filter: `_gcp_request_value ne ${input.requestId} and gcp_signurl ne null and gcp_signurl ne '' and ${identityFilter}`,
    orderby: 'createdon desc',
    // A small defensive window skips malformed legacy rows whose URL contains
    // only whitespace while keeping this identity-scoped query inexpensive.
    top: 10,
  });
};

// ── List ────────────────────────────────────────────────────────────────────

const listSignaturesForRequest = async (
  requestId: string,
): Promise<GcpSignature[]> => {
  const query = buildODataQuery({
    select: SIGNATURE_SELECT,
    filter: `_gcp_request_value eq ${requestId}`,
    orderby: 'createdon asc',
  });
  const res = await powerPagesFetch<ODataListResponse<GcpSignatureEntity>>(
    `${BASE_URL}${query}`,
    { method: 'GET', headers: includeFormattedValues() },
  );
  return (res?.value ?? []).map(mapSignature);
};

const listLatestReusableSignature = async (
  input: ReusableSignatureInput,
): Promise<GcpSignature | null> => {
  const query = buildLatestReusableSignatureQuery(input);
  const res = await powerPagesFetch<ODataListResponse<GcpSignatureEntity>>(
    `${BASE_URL}${query}`,
    { method: 'GET', headers: includeFormattedValues() },
  );
  return findLatestUsableSignature((res?.value ?? []).map(mapSignature));
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

const confirmReusableSignature = async (
  input: CreateSignatureInput,
  io: SignatureConfirmationIo = {
    listForRequest: listSignaturesForRequest,
    create: createSignature,
  },
): Promise<ConfirmReusableSignatureResult> => {
  const identity = resolveSignatureIdentity(
    input.signatoryEmail,
    input.signatoryContactId,
  );
  const existing = (await io.listForRequest(input.requestId)).find(
    (signature) => {
      if (!isUsableSignature(signature)) return false;
      if (signature.signatoryEmail == null) return false;
      const keyMatches =
        normalizeSignatoryEmail(signature.signatoryEmail) ===
        normalizeSignatoryEmail(identity.storageKey);
      if (!keyMatches) return false;
      return identity.kind === 'hoc'
        ? signature.signatoryContactId?.toLowerCase() ===
            identity.contactId?.toLowerCase()
        : true;
    },
  );
  if (existing) {
    return { signatureId: existing.id, alreadySigned: true };
  }

  const signatureId = await io.create({
    ...input,
    signatoryEmail: identity.storageKey,
    signatoryContactId: identity.contactId,
  });
  return { signatureId, alreadySigned: false };
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
  listLatestReusableSignature,
  buildLatestReusableSignatureQuery,
  createSignature,
  confirmReusableSignature,
  isUsableSignature,
  findLatestUsableSignature,
  getSignatureBoxState,
  completeReview,
  ENTITY_SET as SIGNATURE_ENTITY_SET,
};
export type {
  GcpSignature,
  CreateSignatureInput,
  ReusableSignatureInput,
  ConfirmReusableSignatureResult,
  SignatureConfirmationIo,
  SignatureBoxState,
};
