# Project rules — GCP / GCPC Power Pages site

This is a multi-step-form Power Pages code site backed by an **existing Dataverse data model**. Most artifacts you need already exist — reuse before creating.

## 1. Dataverse data model — already exists

**Do NOT propose, create, or modify Dataverse tables, columns, choices, or relationships.** The schema is the source of truth, owned in Dataverse.

When working with data:
- Choice values (integers) and labels are fixed by Dataverse — never invent new ones.
- If a needed choice/column appears to be missing, **ask the user** before assuming it exists or needs to be added. Don't add it speculatively.
- Use the existing TypeScript mirrors in [src/data/](src/data/) — they reflect the Dataverse schema. Update them only when Dataverse itself has changed.

## 2. Dataverse choices — reuse `src/data/*Choices.ts`

All Dataverse choice sets live in [src/data/](src/data/). **Always import from there**; never inline `{ label, value }` lists in forms or pages.

**Convention** (follow exactly when adding a new choice set):

```ts
import type { DataverseChoice } from './types';

const fooChoices = [
  { label: 'Bar', value: 1 },
  { label: 'Baz', value: 2 },
] as const satisfies readonly DataverseChoice[];

type FooValue = (typeof fooChoices)[number]['value'];

export { fooChoices };
export type { FooValue };
```

Rules:
- `value` is the numeric Dataverse choice value. Do not change it.
- Name the export `xxxChoices` (camelCase, plural). No `SCREAMING_SNAKE`, no `_MAP` duplicates.
- Derive the value union type via `(typeof xxxChoices)[number]['value']`.
- Before creating a new choice file, **grep `src/data/` first** — chances are it already exists (e.g. `procurementMethodChoices`, `registrationTypeChoices`, `requestCategoryChoices` are in [requestChoices.ts](src/data/requestChoices.ts)).

To pass choices to a `SelectField`, convert with `toSelectOptions()` from [src/data/types.ts](src/data/types.ts):

```tsx
import { toSelectOptions } from '../data/types';
import { procurementMethodChoices } from '../data/requestChoices';

<SelectField
  name="procurementMethod"
  label="Procurement Method"
  options={toSelectOptions(procurementMethodChoices)}
/>
```

For label lookups (e.g. read-only display): use `getChoiceLabel(choices, value)`.
For parsing form values back to typed values: use `parseChoiceValue(choices, value)`.

## 3. Form fields — reuse `src/forms/*`

All form inputs MUST use the shared field components in [src/forms/](src/forms/). Do not hand-roll `<input>`, `<select>`, MUI `TextField`, etc. inside pages or step components.

Available components ([src/forms/index.ts](src/forms/index.ts)):

| Component | Use for |
|---|---|
| `TextField` | Single-line text |
| `TextAreaField` | Multi-line text |
| `NumberField` | Numeric input |
| `DateField` | Date input |
| `SelectField` | Dropdown (Dataverse choices) |
| `CheckboxField` | Boolean / confirmation |
| `FormField` | Generic label/error/help wrapper for custom inputs |
| `StepIndicator` | Multi-step progress UI |

Shared props (all fields) — `BaseFieldProps` in [src/forms/types.ts](src/forms/types.ts):
`label`, `isRequired`, `isReadOnly`, `mode` (`'new' | 'edit'`), `error`, `helpText`.

See [FormFieldsExample.tsx](src/forms/FormFieldsExample.tsx) for canonical usage.

**Before adding a new field component:**
1. Check [src/forms/](src/forms/) — it probably already exists.
2. If it doesn't, build it as a reusable component in `src/forms/`, extending `BaseFieldProps`, wrapping with `FormField` for consistent label/error/help rendering, and exporting it from [src/forms/index.ts](src/forms/index.ts). Do not inline it in a page.

## 4. Multi-step forms

- Use `StepIndicator` for step progress.
- Compose each step from the shared field components — never duplicate field markup per step.
- Keep step state typed using the value-union types from `src/data/*Choices.ts` (e.g. `ProcurementMethodValue`).

## 5. Icons — always use `lucide-react`

All icons MUST come from [`lucide-react`](https://lucide.dev). It's already a dependency and used across the app (e.g. `StepIndicator`, `MultiStepForm`, `SignInModal`).

- Import named icons: `import { Plus, Trash2 } from 'lucide-react';`
- Render with an explicit `size` (typically `16` inline, `20`–`24` standalone) and `aria-hidden="true"` when the icon is decorative beside a text label; give an `aria-label` on the surrounding control when the icon is the only content (e.g. icon-only buttons).
- Don't use raw glyphs/entities (`×`, `✓`, `→`), emoji, Bootstrap Icons, Font Awesome, or inline `<svg>` for UI iconography. Replace any you find with the lucide equivalent.

## 6. Don't

- Don't create `.js` files alongside `.tsx` — those are stale tsc output.
- Don't inline `{ label, value }` arrays in components.
- Don't import from a `src/data/` file that duplicates another (e.g. the deleted `procurementChoices.ts` — its content is already in `requestChoices.ts`).
- Don't change Dataverse choice integer values to make them "nicer".
- Don't use raw text glyphs, emoji, or non-lucide icon libraries — see §5.

## 7. Deploying

Always pass `--compiledPath` and `--siteName` to `pac pages upload-code-site`. Without `--compiledPath`, PAC CLI uploads the stale snapshot in `.powerpages-site/web-files/` instead of the freshly built `dist/`, and permissions/site-settings update but the SPA bundle does not. The correct command is:

```bash
npm run build
pac pages upload-code-site \
  --rootPath "<absolute path to project root>" \
  --compiledPath "<absolute path to project root>/dist" \
  --siteName "gcp-nexus"
```

After upload, restart the site in Power Pages Studio (Site actions → Restart) so the runtime serves the new bundle, then hard-refresh in an incognito window.

### 7.1 Environments

| Env | Environment ID | Org URL |
|---|---|---|
| **GCP-Developer** (primary dev) | `19d73dc4-0f30-e868-bf7d-8abcd4b89699` | `gcp-developer.crm5.dynamics.com` |
| **PowerPagesProduction** | `f99a8105-8032-ea69-966d-145edf57bc94` | `org09c47a7a.crm5.dynamics.com` (site host: `gcp-nexus-prod.powerappsportals.com`) |

Switch active env before deploying: `pac org select --environment <id>` then verify with `pac org who`. The same `o3csconsultant@O3CS.my` profile has access to both — no separate auth profile needed.

**`pac org select` crash — duplicate auth profiles:** if `org select` dies with `System.InvalidOperationException: Sequence contains more than one matching element` (in `AuthProfiles.Update`), you have duplicate auth profiles. The connection actually validated; only the profile-update step failed. Fix: `pac auth list`, then `pac auth delete --index <dupe>` (or `pac auth clear` + `pac auth create --environment <id>` to re-auth straight onto the target). Goal: exactly one profile per identity.

### 7.2 Production schema gap (as of last deploy, 2026-06-06)

Two recently-added dev tables do **not** exist in PowerPagesProduction yet: `gcp_emailtemplate` and `gcp_signatorymember1`. On upload, their 3 table permissions fail with `XRM Network error: An error occurred in the PowerPageComponentDeletePlugin`:
`EmailTemplate-Admin-Access`, `SignatoryMember1-Admin-Write`, `SignatoryMember1-Global-Read`.

The rest of the site (SPA bundle + all other components) uploads fine; only these 3 permissions are skipped. To clear it, migrate the two table schemas to Production via **solution import** (don't create them ad hoc — schema is owned in Dataverse, §1), then re-run the upload.

### 7.3 Function-call auth: portal token, NOT MSAL (2026-06-06 rework)

The SPA calls our Azure Functions (`spa-integration-func`: SharePoint upload, web-role / signatory management, notifications). It authenticates with a **Power Pages portal token**, not MSAL.

**Why the switch:** the SPA runs inside the Power Pages *sandboxed iframe*. MSAL's silent token flow opens a hidden iframe to `login.microsoftonline.com` — a nested third-party context where browsers block cookies, so the redirect never completes → `monitor_window_timeout` on `/user-roles`, `/signatories`, the Request Detail signature section, and RTP upload (which also showed `Unsafe attempt to initiate navigation … sandboxed`). Registering redirect URIs does **not** fix it — the flow is blocked before the redirect.

**How it works now** (Microsoft's documented pattern — [implicit grant flow](https://learn.microsoft.com/power-pages/security/oauth-implicit-grant-flow)):
- FE [src/shared/portalToken.ts](src/shared/portalToken.ts) does a *same-origin* `POST /_services/auth/token?client_id=<id>` → returns the signed-in user's ID token (JWT) in the body. No iframe, no third-party cookies.
- Function [api/src/auth/validateToken.ts](api/src/auth/validateToken.ts) validates it: signature against `<portal>/_services/auth/publickey`, `iss` ∈ allow-list, `aud`/`appid` == registered client id. Authorizes off the token's `sub` (contact id) via `isAdminByContactId`.
- Required config: site settings `ImplicitGrantFlow/RegisteredClientId` + `Connector/ImplicitGrantFlowEnabled` (in `.powerpages-site/site-settings/`, deploy to **both** portals); Function App settings `PORTAL_BASE_URLS` (comma-separated dev+prod origins) + `PORTAL_CLIENT_ID`; FE env `VITE_PORTAL_TOKEN_CLIENT_ID`.
- ⚠️ **Implicit-grant signing certificate is REQUIRED** — without it `/_services/auth/token` returns `PortalSTS0018: The Implicit Grant certificate was not found`. The default cert was deprecated (Oct 2022), so each portal needs a **custom cert**: upload a `.pfx` in Power Platform Admin Center (site → Security → Custom Certificates; must be 2048-bit, SHA-2, EKU server-auth `1.3.6.1.5.5.7.3.1`, and **PFX TripleDES-encrypted — AES-256 is NOT supported**), then set site setting `CustomCertificates/ImplicitGrantflow` = cert thumbprint and **restart the site**. GCP-Developer uses self-signed thumbprint `99350A6E6D38C03D8A4131EC75FB2B419E7E2413` (expires 2031-06-07); see [CustomCertificates-ImplicitGrantflow.sitesetting.yml](.powerpages-site/site-settings/CustomCertificates-ImplicitGrantflow.sitesetting.yml). **Prod still needs the cert uploaded + this setting deployed.** Export a store cert to a compatible PFX with: `Export-PfxCertificate -Cert Cert:\CurrentUser\My\<thumbprint> -FilePath out.pfx -Password $pw -CryptoAlgorithmOption TripleDES_SHA1`.
- **Breaking/lockstep:** the Function now rejects Entra tokens, so the new Function + new SPA (both portals) must deploy together.
- Function App CORS must list both portal origins (dev was present; prod `https://gcp-nexus-prod.powerappsportals.com` added 2026-06-06).
- ⚠️ **Verify after deploy:** `validateToken` logs the portal token's claim *keys* once per cold start (App Insights). Confirm the contact id really arrives as `sub` (the `CONTACT_ID_CLAIMS` fallback list covers `nameid`/`contactid` otherwise).

**Still open (unrelated):** `/slots` save fails with `9004010A` — server-side plugin/permission error on the slot table in Production.
