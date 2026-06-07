// src/shared/services/emailTemplateService.ts
// CRUD service for the gcp_emailtemplate table (admin-editable email templates).
//
// Power Pages site settings & table permissions for `gcp_emailtemplate` must be
// configured (Webapi/gcp_emailtemplate/enabled = true, Webapi/gcp_emailtemplate/fields,
// plus a table permission granting the Administrators web role full CRUD).

import {
  buildODataQuery,
  extractRecordId,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';
import {
  DEFAULT_TEMPLATE_SELECT,
  mapEmailTemplate,
} from '../../types/emailTemplate';
import type {
  EmailTemplate,
  EmailTemplateEntity,
  EmailTemplateInput,
} from '../../types/emailTemplate';

const ENTITY_SET = 'gcp_emailtemplates';
const BASE_URL = `/_api/${ENTITY_SET}`;

// ── List (all templates; the admin page groups them by event/role in memory) ─
const listEmailTemplates = async (): Promise<EmailTemplate[]> => {
  const query: ODataQuery = {
    select: DEFAULT_TEMPLATE_SELECT,
    orderby: 'gcp_eventkey asc,gcp_recipientrole asc',
  };
  const res = await powerPagesFetch<ODataListResponse<EmailTemplateEntity>>(
    `${BASE_URL}${buildODataQuery(query)}`,
    { method: 'GET' }
  );
  return (res?.value ?? []).map(mapEmailTemplate);
};

// ── Get by ID ─────────────────────────────────────────────────────────────────
const getEmailTemplateById = async (id: string): Promise<EmailTemplate | null> => {
  const query: ODataQuery = { select: DEFAULT_TEMPLATE_SELECT };
  try {
    const entity = await powerPagesFetch<EmailTemplateEntity>(
      `${BASE_URL}(${id})${buildODataQuery(query)}`,
      { method: 'GET' }
    );
    return entity ? mapEmailTemplate(entity) : null;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
};

// ── Create ──────────────────────────────────────────────────────────────────
const createEmailTemplate = async (input: EmailTemplateInput): Promise<string> => {
  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: input,
  });
  const id = extractRecordId(res);
  if (!id) throw new Error('Create succeeded but no record ID was returned.');
  return id;
};

// ── Update ──────────────────────────────────────────────────────────────────
const updateEmailTemplate = async (
  id: string,
  input: Partial<EmailTemplateInput>
): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: input,
    headers: { 'If-Match': '*' },
  });
};

export {
  listEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  ENTITY_SET as EMAIL_TEMPLATE_ENTITY_SET,
};
