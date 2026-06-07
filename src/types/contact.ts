// src/types/contact.ts
// Minimal type definitions for the Dataverse `contact` system table.
// Read-only — we use this to resolve the logged-in portal user's contact GUID
// so it can be bound into lookup columns (e.g. gcp_request.gcp_RequestorName).

/** Raw OData entity shape returned by /_api/contacts. */
export interface ContactEntity {
  contactid: string;
  firstname?: string | null;
  lastname?: string | null;
  fullname?: string | null;
  emailaddress1?: string | null;
  telephone1?: string | null;
  /** GUID of the parent account (lookup _value form). */
  _parentcustomerid_value?: string | null;
  /** Formatted display value (e.g. account name) — present when the request
   *  prefers `odata.include-annotations="OData.Community.Display.V1.FormattedValue"`. */
  '_parentcustomerid_value@OData.Community.Display.V1.FormattedValue'?: string;
  /** Logical name of the lookup target (account vs systemuser) — present with `*` annotations. */
  '_parentcustomerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'?: string;
  /** Expanded parent account record (when $expand=parentcustomerid_account). */
  parentcustomerid_account?: {
    accountid: string;
    name?: string | null;
  } | null;
}

/** Clean domain type for app code. */
export interface Contact {
  contactId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  parentAccountId: string | null;
  parentAccountName: string | null;
}

/** Columns we ever $select on the contact entity. */
export const CONTACT_SELECT = [
  'contactid',
  'firstname',
  'lastname',
  'fullname',
  'emailaddress1',
  'telephone1',
  '_parentcustomerid_value',
] as const;

/** Map a raw OData contact to the clean domain type. */
export const mapContact = (e: ContactEntity): Contact => ({
  contactId: e.contactid,
  firstName: e.firstname ?? '',
  lastName: e.lastname ?? '',
  fullName: e.fullname ?? `${e.firstname ?? ''} ${e.lastname ?? ''}`.trim(),
  email: e.emailaddress1 ?? '',
  phone: e.telephone1 ?? '',
  parentAccountId: e._parentcustomerid_value ?? null,
  parentAccountName:
    e.parentcustomerid_account?.name ??
    e['_parentcustomerid_value@OData.Community.Display.V1.FormattedValue'] ??
    null,
});
