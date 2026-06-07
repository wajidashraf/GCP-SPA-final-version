// src/data/webRoles.ts
// Static catalog of the site's Power Pages web roles, mirroring the records in
// .powerpages-site/web-roles/*.webrole.yml (which mirror Dataverse `adx_webrole`).
//
// Web roles cannot be read through the Power Pages Web API — the platform
// rejects table permissions on the `adx_webrole` configuration table — so the
// admin User Role Management page sources the role list from here instead.
// Keep this in sync with the web-role YAML files; the GUIDs are the Dataverse
// adx_webroleid values and must not be changed.

export interface WebRole {
  id: string;
  name: string;
}

const webRoles: readonly WebRole[] = [
  { id: 'f48675b4-13bf-459d-8a1d-f9a42f468dba', name: 'Administrators' },
  { id: 'a479817d-fa2b-43f4-9838-3a5a8d2a2b07', name: 'Authenticated Users' },
  { id: '0f1c4730-d1cd-4f75-a6df-7da7b73a19d0', name: 'Anonymous Users' },
  { id: '063d366d-4b7c-4bae-8651-2e98f1515013', name: 'Requestor' },
  { id: 'b079a542-bca0-43b7-a964-642298845ba1', name: 'Reviewer' },
  { id: 'a9024323-2bc2-4fc9-b7cf-aafb69581168', name: 'Verifier' },
  { id: '7a1e229c-567b-4bbf-ae02-522e59efcff2', name: 'HOC' },
  { id: 'f196430f-16b6-4fe0-b0f6-582c30532184', name: 'Working GCPC' },
  { id: '712bfc10-3359-4685-8f1f-69cd1db4f91a', name: 'Endorser' },
  { id: 'c4a9f7e2-8b6d-4e1c-a3f5-2d9e7b4c6a1f', name: 'Main Committee' },
] as const;

export { webRoles };
