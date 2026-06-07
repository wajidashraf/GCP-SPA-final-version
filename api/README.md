# GCP Nexus — SharePoint Upload Function

Azure Functions (Node.js + TypeScript) backend that receives files from the
Power Pages SPA and stores them in a SharePoint document library via Microsoft
Graph.

```
Power Pages SPA (FileUpload)
   │  multipart/form-data + Authorization: Bearer <Entra token>
   ▼
Azure Function  POST /api/uploadFile
   │  1. validate JWT (issuer / audience / JWKS / scope)
   │  2. parse multipart, enforce size + type limits
   │  3. ClientSecretCredential → Microsoft Graph (client-credentials)
   ▼
SharePoint document library  →  returns { id, name, webUrl }
```

## Project layout

| File | Purpose |
|---|---|
| `src/functions/uploadFile.ts` | HTTP trigger — orchestrates auth → parse → upload |
| `src/auth/validateToken.ts` | Validates the incoming Entra bearer token (jose + JWKS) |
| `src/sharepoint/graphClient.ts` | App-only Graph client (client-credentials) |
| `src/sharepoint/uploadToSharePoint.ts` | Site/drive resolution + small & chunked upload |
| `src/config.ts` | Validated access to app settings |

---

## 1. Entra app registrations

You need **two app registrations** (you *can* collapse them into one — see the
note at the end — but two is cleaner and follows least-privilege).

### App A — "GCP Upload API" (token audience for the SPA)
Validates the user calling the Function.

1. **App registrations → New registration.** Name: `GCP Upload API`.
2. **Expose an API** → set Application ID URI to `api://<App A client id>`.
3. **Add a scope**: name `access_as_user`, admins+users consent, enabled.
4. **Authentication → Add platform → Single-page application.** Redirect URIs:
   - `https://<your-powerpages-domain>` (e.g. `https://gcp-nexus.powerappsportals.com`)
   - `http://localhost:5173` (Vite dev)
5. Note the **client id** and **tenant id**.

> The SPA's `VITE_MSAL_CLIENT_ID` = App A client id, and
> `VITE_UPLOAD_API_SCOPE` = `api://<App A client id>/access_as_user`.

### App B — "GCP Upload Graph Daemon" (Function → SharePoint)
Authenticates the Function to Graph with a client secret.

1. **New registration.** Name: `GCP Upload Graph Daemon`.
2. **Certificates & secrets → New client secret.** Copy the **value** (store it
   in Function App settings / Key Vault — never in source).
3. **API permissions → Microsoft Graph → Application permissions**:
   - `Sites.Selected` *(recommended, least privilege)* **or** `Files.ReadWrite.All`.
4. **Grant admin consent.**
5. If you chose **`Sites.Selected`**, grant App B write access to the specific
   site (run as a Graph admin):

   ```http
   POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
   {
     "roles": ["write"],
     "grantedToIdentities": [
       { "application": { "id": "<App B client id>", "displayName": "GCP Upload Graph Daemon" } }
     ]
   }
   ```
   Get `{site-id}` with: `GET /sites/{hostname}:/sites/{site-name}`.

---

## 2. Function App settings

Set these on the Function App (Portal → Configuration, or `az functionapp
config appsettings set`). Locally, copy `local.settings.json.example` →
`local.settings.json` and fill the same keys.

| Setting | Value |
|---|---|
| `TENANT_ID` | Entra tenant GUID |
| `API_CLIENT_ID` | **App A** client id (token audience) |
| `API_ALLOWED_SCOPE` | `access_as_user` |
| `GRAPH_CLIENT_ID` | **App B** client id (or the same single app id) |
| `GRAPH_CLIENT_SECRET` | client secret value *(use a Key Vault reference in prod)* |
| `SHAREPOINT_SITE_ID` | **Preferred** — pre-resolved Graph site id |
| `SHAREPOINT_DRIVE_ID` | **Preferred** — pre-resolved drive (library) id |
| `SHAREPOINT_HOSTNAME` | Fallback (only if SITE_ID blank): `<tenant>.sharepoint.com` |
| `SHAREPOINT_SITE_PATH` | Fallback: `/sites/<your-site>` |
| `SHAREPOINT_LIBRARY` | Fallback: library display name (default `Documents`) |
| `SHAREPOINT_ROOT_FOLDER` | Top folder for uploads (default `GCP-Uploads`) |
| `MAX_FILE_BYTES` | Max upload size (default `10485760` = 10 MB) |

> This project uses a **single** app registration (`GCP-Nexus`) for both the
> token audience and Graph — set `API_CLIENT_ID` and `GRAPH_CLIENT_ID` to the
> same client id. Get the site/drive ids from Graph Explorer:
> `GET /sites/{tenant}.sharepoint.com:/sites/{site}` then
> `GET /sites/{site-id}/drives`.

### CORS
Add your Power Pages origin so the browser can call the Function:

```bash
az functionapp cors add -g <rg> -n <func-app> \
  --allowed-origins https://gcp-nexus.powerappsportals.com http://localhost:5173
```

Keep "Enable Access-Control-Allow-Credentials" **off** — we use a bearer token,
not cookies.

---

## 3. Local development

```bash
cd api
npm install
cp local.settings.json.example local.settings.json   # then fill in values
npm start            # func start  (http://localhost:7071/api/uploadFile)
```

Requires the [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

---

## 4. Deploy

```bash
cd api
npm install
npm run build
func azure functionapp publish <your-func-app-name>
```

(or `az functionapp deployment source config-zip`, or VS Code Azure Functions
extension). Make sure the app settings from §2 are set on the target app.

---

## 5. Wiring the SPA

In the repo root, copy `.env.example` → `.env.local` and fill:

```
VITE_UPLOAD_FN_BASEURL=https://<your-func-app>.azurewebsites.net
VITE_MSAL_CLIENT_ID=<App A client id>
VITE_MSAL_TENANT_ID=<tenant id>
VITE_UPLOAD_API_SCOPE=api://<App A client id>/access_as_user
```

Then a form supplies the uploader to `<FileUpload />`:

```tsx
import { FileUpload } from '../FileUpload';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { useAuth } from '../../context/AuthContext';

const { user } = useAuth();

<FileUpload
  label="Cashflow Forecast"
  uploader={makeSharePointUploader({
    entityType: 'jvp',
    requestId: draftOrRecordId,
    fieldName: 'cashflowForecast',
    loginHint: user?.email,
  })}
  onChange={(files) => {
    // files[n].url is the SharePoint webUrl once progress hits 100.
  }}
/>
```

> Files land in `<SHAREPOINT_ROOT_FOLDER>/<entityType>/<requestId>/<filename>`.
> For **new** records (no GUID yet) pass a draft id; persist `file.url` onto the
> Dataverse record at submit time (column TBD — confirm before writing).

---

## 6. Web-role management (assign / unassign portal roles)

The admin **User Role Management** page assigns and removes Power Pages web
roles for contacts. Web roles live in **Dataverse** (the `mspp_webrole` /
`adx_webrole` table) and assigning one writes the **N:N relationship** between
`contact` and the web-role table — so this goes through the Dataverse Web API,
**not** Microsoft Graph. (Graph permissions like `User.ReadWrite.All` manage
Azure AD user profiles and do nothing for web roles.)

```
Power Pages SPA (UserRoleManagement)
   │  Authorization: Bearer <Entra token>   (same MSAL flow as upload)
   ▼
Azure Function  GET /api/webRoles · GET|POST /api/contacts/{id}/webRoles
   │  1. validate JWT (issuer / audience / JWKS / scope)
   │  2. re-check the CALLER holds the Administrators web role (server-side)
   │  3. ClientSecretCredential → Dataverse Web API (client-credentials)
   ▼
Dataverse  associate/disassociate contact ↔ web role
```

### One-time setup — make the app a Dataverse Application User

The app registration the Function authenticates with (`GRAPH_CLIENT_ID`, or a
dedicated `DATAVERSE_CLIENT_ID`) must exist as an **Application User** in the
environment, with permission to read/write contacts and the web-role N:N:

1. **Power Platform admin center → Environments → [your env] → Settings →
   Users + permissions → Application users → + New app user.**
2. **Add an app** → pick the registration (by client id) → set the **Business
   unit** → **Create**.
3. Assign a **security role** that can read/write `Contact` and the web-role
   table and append the relationship. The built-in **System Administrator**
   role works; for least privilege, create a custom role with Read/Write/Append/
   Append To on `Contact` and `Web Role`.
4. The app's client secret is the same one in `GRAPH_CLIENT_SECRET` (or set a
   dedicated `DATAVERSE_CLIENT_SECRET`).

### App settings

| Setting | Value |
|---|---|
| `DATAVERSE_URL` | Environment URL, e.g. `https://org.crm.dynamics.com` (no trailing slash) |
| `DATAVERSE_API_VERSION` | Web API version (default `v9.2`) |
| `DATAVERSE_CLIENT_ID` | *(optional)* dedicated Dataverse app id; defaults to `GRAPH_CLIENT_ID` |
| `DATAVERSE_CLIENT_SECRET` | *(optional)* dedicated secret; defaults to `GRAPH_CLIENT_SECRET` |
| `WEBROLE_ENTITY_SET` | Web-role / `$ref` target entity set (default `powerpagecomponents`) |
| `WEBROLE_ID_ATTR` | Primary key attr (default `powerpagecomponentid`) |
| `WEBROLE_NAME_ATTR` | Name attr (default `name`) |
| `WEBROLE_CONTACT_NAV` | N:N nav property contact→roles (default `powerpagecomponent_mspp_webrole_contact`) |
| `WEBROLE_LIST_FILTER` | `$filter` isolating role rows (default `powerpagecomponenttype eq 11`) |
| `ADMIN_WEBROLE_NAME` | Web role allowed to manage roles (default `Administrators`) |

> **Why `powerpagecomponent`, not `mspp_webrole`?** Modern Power Pages stores
> web roles in the unified `powerpagecomponent` table (component type 11), and
> the contact↔role N:N relationship (`powerpagecomponent_mspp_webrole_contact`)
> is defined there. The `mspp_webrole` *view* can't be traversed for the N:N and
> exposes duplicate-named legacy rows. Assigning uses the role's
> `powerpagecomponentid` (same GUID as `mspp_webroleid`) against
> `/powerpagecomponents`. Defaults above are verified against GCP-Developer.
>
> **If your environment differs**, find the real names with:
> `GET {DATAVERSE_URL}/api/data/v9.2/EntityDefinitions(LogicalName='contact')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity1NavigationPropertyName,Entity2LogicalName,Entity2NavigationPropertyName`
> and set `WEBROLE_CONTACT_NAV` (no redeploy — it's an app setting).

No new SPA env vars are needed — the page reuses `VITE_UPLOAD_FN_BASEURL`,
`VITE_MSAL_CLIENT_ID` and `VITE_UPLOAD_API_SCOPE`.

---

### Note: collapsing to a single app registration
One app reg can both expose the API (audience) **and** hold the Graph app
permission + secret. If you do that, set `API_CLIENT_ID` and `GRAPH_CLIENT_ID`
to the same value. Two registrations is the cleaner, least-privilege default.
