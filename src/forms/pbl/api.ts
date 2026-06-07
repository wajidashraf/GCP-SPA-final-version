// src/forms/pbl/api.ts
// PBL submission flow:
//   1. POST /_api/gcp_requests       — parent request row, bound to selected
//      Project (gcp_Project) and Company (gcp_Company).
//   2. POST /_api/gcp_pblrequests    — PBL details, bound to (1) via
//      `gcp_Request@odata.bind` plus Project lookup.
//   3. POST /_api/gcp_pblbidderses   — one row per bidder, each bound to (2)
//      via `gcp_PBLRequest@odata.bind`. Justification (if <3 bidders) is
//      stored on every bidder row per the table schema.

import { createRequest } from '../../shared/services/requestService';
import { createPblRequest } from '../../shared/services/pblRequestService';
import { createPblBidder } from '../../shared/services/pblBidderService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpPblRequestInput } from '../../types/pblRequest';
import type { CreateGcpPblBidderInput } from '../../types/pblBidder';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { PblFormState } from './types';

type SubmitResult = {
  requestId: string;
  pblRequestId: string;
  bidderIds: string[];
};

// SOA code "PBL" maps to value 2 in soaCodeChoices.
const resolveSoaCodeForPbl = (): SoaCodeValue => 2;

type SubmitPblOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitPblRequest = async (
  data: PblFormState,
  options: SubmitPblOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForPbl(),
    gcp_requestoremail: data.requestorEmail || null,
    gcp_project_name: data.projectName || null,
    gcp_projectcode: data.projectCode || null,
    gcp_acknowledgement: data.acknowledged,
    gcp_submittedon: new Date().toISOString(),
    gcp_requeststatus: 1,
    gcp_documentsurl: serializeDocuments(options.documents ?? []),
  };

  const created = await createRequest(parentInput, {
    lookups: {
      requestorContactId: options.requestorContactId || null,
      companyAccountId,
      projectId,
    },
  });

  // Step 2 — gcp_pblrequest bound to the parent. Per spec, only the project
  // lookup, project code, and procurement method live on this table; the
  // acknowledgement is stored on the parent gcp_request.
  const pblInput: CreateGcpPblRequestInput = {
    gcp_projectcode: data.projectCode || null,
    gcp_procurementmethod:
      data.procurementMethod === '' ? null : data.procurementMethod,
  };

  const pblCreated = await createPblRequest(pblInput, {
    lookups: {
      requestId: created.id,
      projectId,
    },
  });

  // Step 3 — one row per bidder
  const justification =
    data.bidders.length < 3 ? data.justificationForLessBidders || null : null;

  const bidderIds: string[] = [];
  for (const b of data.bidders) {
    // When the user picks "Other", only the free-text company name is stored
    // (gcp_company); the account lookup stays unbound. When a real account is
    // selected, both columns are populated for consistency.
    const isOther = b.isOtherCompany || !b.companyAccountId;
    const input: CreateGcpPblBidderInput = {
      gcp_pblbiddername: b.companyName || 'Bidder',
      gcp_company: (b.companyName || '').slice(0, 100),
      gcp_sector: b.sector === '' ? null : b.sector,
      gcp_location: b.location || null,
      gcp_person_in_charge: b.personInCharge || null,
      gcp_piccontactnumber: b.picContactNumber || null,
      gcp_recommendedby: b.recommendationBy || null,
      gcp_sourcesfrom: b.sourcesFrom || null,
      gcp_justificationforlt3bidders: justification,
    };
    const bidder = await createPblBidder(input, {
      lookups: {
        pblRequestId: pblCreated.id,
        companyAccountId: isOther ? null : b.companyAccountId,
      },
    });
    bidderIds.push(bidder.id);
  }

  return {
    requestId: created.id,
    pblRequestId: pblCreated.id,
    bidderIds,
  };
};

export { submitPblRequest };
export type { SubmitResult };
