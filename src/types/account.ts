// src/types/account.ts
// Minimal type definitions for the Dataverse `account` system table.
// Read-only — used to resolve a Company lookup (gcp_request.gcp_Company,
// gcp_rtprequest.gcp_Company) from a company code picklist value or GUID.

import type { CompanyCodeValue } from '../data/companyChoices';
import type { SectorValue } from '../data/projectChoices';

/** Raw OData entity shape returned by /_api/accounts. */
export interface AccountEntity {
  accountid: string;
  name?: string | null;
  /** Standard system field. Not used for company-code lookup on this site. */
  accountnumber?: string | null;
  /**
   * Custom picklist column on account (see customizations.xml).
   * Integer value matching `companyCodeChoices` in src/data/companyChoices.ts.
   */
  gcp_companycode?: number | null;
  /** Sector picklist (gcp_sectorslist). Integer value matches sectorChoices. */
  gcp_sector?: number | null;
  /** GUID of the parent account (lookup _value form). */
  _parentaccountid_value?: string | null;
}

/** Clean domain type for app code. */
export interface Account {
  accountId: string;
  name: string;
  accountNumber: string | null;
  companyCode: CompanyCodeValue | number | null;
  sector: SectorValue | number | null;
  parentAccountId: string | null;
}

/** Default columns to $select on the account entity. */
export const ACCOUNT_SELECT = [
  'accountid',
  'name',
  'accountnumber',
  'gcp_companycode',
  'gcp_sector',
  '_parentaccountid_value',
] as const;

/** Map a raw OData account to the clean domain type. */
export const mapAccount = (e: AccountEntity): Account => ({
  accountId: e.accountid,
  name: e.name ?? '',
  accountNumber: e.accountnumber ?? null,
  companyCode: (e.gcp_companycode ?? null) as CompanyCodeValue | number | null,
  sector: (e.gcp_sector ?? null) as SectorValue | number | null,
  parentAccountId: e._parentaccountid_value ?? null,
});
