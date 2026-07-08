# Server Logic migration — signatory pilot

> **Docs folder.** The *deployed* server-logic sources live under
> [`.powerpages-site/server-logic/`](../.powerpages-site/server-logic/) and are
> pushed by `pac pages upload-code-site`. This file just documents the pilot.

Migrating the four Azure Function capabilities to Power Pages **Server Logic** so
the site no longer depends on an external Function App (the thing that went down
when the Azure subscription was disabled), MSAL, the portal implicit-grant
certificate, or cross-origin CORS. Server logic endpoints are **same-origin**
(`/_api/serverlogics/<name>`) and authorize natively via web roles.

| Feature | Status |
|---|---|
| Signatory management | ✅ this pilot (deployed to GCP-Developer) |
| SharePoint upload | later (needs app reg + Graph + binary/size check) |
| Notification email | later (Graph Mail.Send) |
| Web-role assign/unassign | later (S2S to Dataverse Web API) |

## What was deployed

Two server logics, stored as code-site files and uploaded via PAC:

| `.powerpages-site/server-logic/<name>/` | Endpoint | Verbs |
|---|---|---|
| `signatorymembers` | `/_api/serverlogics/signatorymembers` | `get`=list, `post`=add, `del`=remove `?id=` |
| `signatorythresholds` | `/_api/serverlogics/signatorythresholds` | `get`=read, `put`=set |

Each `<name>/` folder has `<name>.js` (code) + `<name>.serverlogic.yml`
(metadata: `id`, `name`, and `adx_serverlogic_adx_webrole` = assigned web-role
GUIDs). The pre-existing `test` logic is preserved.

### Security model

- Both logics are assigned the **Authenticated Users** web role
  (`a479817d-fa2b-43f4-9838-3a5a8d2a2b07`) so any signed-in user can invoke them
  (the signature panel needs to *read* members/thresholds for everyone).
- **Writes are gated in code** by `requireAdmin()` → `Server.User.Roles` must
  contain `Administrators`. The check is **fail-closed**: if roles can't be read
  it denies, so there's no privilege-escalation risk.
- `gcp_signatorymember1` table permissions remain a second line of defence.

### Client

[`src/shared/signatoryApi.ts`](../src/shared/signatoryApi.ts) calls these
endpoints via the site's same-origin `powerPagesFetch` (anti-forgery token +
session cookie) and unwraps the `{ ok, data | error }` payload. Exported surface
is unchanged, so `SignatoryManagement.tsx` and `SignatureSection.tsx` are
untouched.

## Deploy

```bash
npm run build
pac org select --environment 19d73dc4-0f30-e868-bf7d-8abcd4b89699   # GCP-Developer
pac pages upload-code-site \
  --rootPath "<project root>" \
  --compiledPath "<project root>/dist" \
  --siteName "gcp-nexus"
```

Then restart the site (Power Pages Studio → Site actions → Restart) and hard-
refresh in an incognito window.

## Verify (runtime — needs a signed-in browser)

1. **As an admin:** Signatory Management → list loads; add a member; remove it;
   change thresholds. All succeed.
2. **As a non-admin:** the signature section on a Request Detail page still
   **reads** members/thresholds, but add/remove/set is rejected with
   "You must be an administrator…". Confirms the in-code gate.

If admin writes are unexpectedly rejected, open the site's server-logic
DevTools/log — `requireAdmin()` logs `signatory roles: …` so we can see the
actual shape of `Server.User.Roles` and adjust the role-name match.

## Rollback

Revert `src/shared/signatoryApi.ts` (restores the Azure Function path, reachable
only once the Azure subscription is re-enabled), and/or remove the two
server-logic folders and re-upload.
