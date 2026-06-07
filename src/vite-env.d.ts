/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the upload Azure Function App, e.g. https://gcp-upload.azurewebsites.net */
  readonly VITE_UPLOAD_FN_BASEURL?: string;
  /** Client id of the Entra app registration that exposes the upload API + is registered as a SPA. */
  readonly VITE_MSAL_CLIENT_ID?: string;
  /** Entra tenant id (GUID) used to build the MSAL authority. */
  readonly VITE_MSAL_TENANT_ID?: string;
  /** Full API scope the SPA requests, e.g. api://<client-id>/access_as_user */
  readonly VITE_UPLOAD_API_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
