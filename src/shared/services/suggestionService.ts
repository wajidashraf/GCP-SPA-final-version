// src/shared/services/suggestionService.ts
// CRUD service for the gcp_suggestions table.
//
// Power Pages site settings: Webapi/gcp_suggestion/enabled = true
// Table permissions: Working GCPC + Admin + Reviewer must have Create/Read/Write.

import {
  buildODataQuery,
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse } from '../powerPagesApi';

const ENTITY_SET = 'gcp_suggestions';
const BASE_URL = `/_api/${ENTITY_SET}`;

type GcpSuggestionEntity = {
  gcp_suggestionid: string;
  gcp_suggestiontext: string | null;
  gcp_suggestionby: string | null;
  gcp_suggestionaccepted: boolean | null;
  createdon: string | null;
};

type GcpSuggestion = {
  id: string;
  suggestionText: string | null;
  suggestionBy: string | null;
  suggestionAccepted: boolean;
  createdOn: string | null;
};

type CreateSuggestionInput = {
  requestId: string;
  contactId: string | null;
  suggestionText: string;
  suggestionBy: string;
};

const mapSuggestion = (e: GcpSuggestionEntity): GcpSuggestion => ({
  id: e.gcp_suggestionid,
  suggestionText: e.gcp_suggestiontext ?? null,
  suggestionBy: e.gcp_suggestionby ?? null,
  suggestionAccepted: e.gcp_suggestionaccepted ?? false,
  createdOn: e.createdon ?? null,
});

// ── List ────────────────────────────────────────────────────────────────────

const listSuggestionsForRequest = async (
  requestId: string,
): Promise<GcpSuggestion[]> => {
  const query = buildODataQuery({
    select: [
      'gcp_suggestionid',
      'gcp_suggestiontext',
      'gcp_suggestionby',
      'gcp_suggestionaccepted',
      'createdon',
    ],
    filter: `_gcp_request_value eq ${requestId}`,
    orderby: 'createdon desc',
  });
  const res = await powerPagesFetch<ODataListResponse<GcpSuggestionEntity>>(
    `${BASE_URL}${query}`,
    { method: 'GET' },
  );
  return (res?.value ?? []).map(mapSuggestion);
};

// ── Create ──────────────────────────────────────────────────────────────────

const createSuggestion = async (
  input: CreateSuggestionInput,
): Promise<string> => {
  const body: Record<string, unknown> = {
    gcp_suggestiontext: input.suggestionText.trim(),
    gcp_suggestionby: input.suggestionBy.trim(),
    gcp_suggestionaccepted: false,
    'gcp_Request@odata.bind': odataBind('gcp_requests', input.requestId),
  };
  if (input.contactId) {
    body['gcp_Contact@odata.bind'] = odataBind('contacts', input.contactId);
  }
  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
  });
  const id = extractRecordId(res);
  if (!id) throw new Error('Create succeeded but no record ID was returned.');
  return id;
};

// ── Mark accepted ───────────────────────────────────────────────────────────

const markSuggestionsAccepted = async (
  suggestionIds: string[],
): Promise<void> => {
  await Promise.all(
    suggestionIds.map((sid) =>
      powerPagesFetch<void>(`${BASE_URL}(${sid})`, {
        method: 'PATCH',
        json: { gcp_suggestionaccepted: true },
        headers: { 'If-Match': '*' },
      }),
    ),
  );
};

export {
  listSuggestionsForRequest,
  createSuggestion,
  markSuggestionsAccepted,
  ENTITY_SET as SUGGESTION_ENTITY_SET,
};
export type { GcpSuggestion, CreateSuggestionInput };
