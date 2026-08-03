# Deploy GCP Nexus to Development

Use this PowerShell runbook to deploy the current SPA to the **GCP-Developer**
Power Pages environment. It does not deploy to production.

## Verified target

- Environment: `GCP-Developer`
- Environment ID: `19d73dc4-0f30-e868-bf7d-8abcd4b89699`
- Dataverse URL: `https://gcp-developer.crm5.dynamics.com/`
- Power Pages site: `gcp-nexus`
- Website: `https://gcp-nexus.powerappsportals.com/`
- Expected PAC user: `o3csconsultant@O3CS.my`

## 1. Open the repository

```powershell
$ProjectRoot = 'C:\Users\Administrator\Videos\gcp-final'
Set-Location $ProjectRoot

git status --short --branch
Get-Content .\PROJECT_CONTEXT_REPORT.md
```

Review `git status` before continuing. Do not discard unrelated local changes.

## 2. Verify PAC CLI and select the correct account

```powershell
pac help
pac auth list
pac auth select --name 'GCP-Developer'
pac auth who
```

The selected profile must use `o3csconsultant@O3CS.my`. The profile may initially
point to production, so do not upload yet.

## 3. Select and verify GCP-Developer

```powershell
pac org select --environment '19d73dc4-0f30-e868-bf7d-8abcd4b89699'
pac org who
```

Stop unless `pac org who` shows all of these values:

- Friendly Name: `GCP-Developer`
- Org URL: `https://gcp-developer.crm5.dynamics.com/`
- Environment ID: `19d73dc4-0f30-e868-bf7d-8abcd4b89699`
- User Email: `o3csconsultant@O3CS.my`

PAC can print an error while returning exit code `0`. Always read the command
output and confirm that the environment actually changed.

## 4. Build the SPA

Build immediately before uploading:

```powershell
npm run build
```

Stop if TypeScript or Vite reports a build error. The large-chunk warning is
non-blocking.

## 5. Verify the site configuration

```powershell
Get-Content .\powerpages.config.json
pac pages list -v
```

Confirm that:

- `siteName` is `gcp-nexus`;
- `outputPath` is `dist`;
- `gcp-nexus` is listed as an active Single Page Application;
- its data model version is `Enhanced`.

## 6. Check the upload manifest

```powershell
$ManifestPath = Join-Path $ProjectRoot '.powerpages-site\.portalconfig\manifest.yml'
$ManifestText = Get-Content -Raw $ManifestPath
$EntityPermissionSection = [regex]::Match(
  $ManifestText,
  '(?ms)^adx_entitypermission:\s*(.*?)(?=^[A-Za-z0-9_]+:\s*$|\z)'
)

if (
  $EntityPermissionSection.Success -and
  $EntityPermissionSection.Value -match 'IsDeleted:\s*true'
) {
  throw 'STOP: manifest contains adx_entitypermission deletion tombstones.'
}

Get-Content $ManifestPath
```

Old `adx_webfile` bundle deletions are expected. Stop if an
`adx_entitypermission` section contains `IsDeleted: true`; that indicates the
known Standard/Enhanced data-model mismatch.

## 7. Upload the compiled site

Always include `--compiledPath`. Omitting it can upload the stale web-files
snapshot instead of the current build.

```powershell
pac pages upload-code-site `
  --rootPath 'C:\Users\Administrator\Videos\gcp-final' `
  --compiledPath 'C:\Users\Administrator\Videos\gcp-final\dist' `
  --siteName 'gcp-nexus'
```

## 8. Confirm success

Treat the upload as successful only when PAC prints all of the following:

- progress reaches `100.0%`;
- `Power Pages website upload succeeded`;
- `Upload complete`.

Treat it as failed if the output contains `Error:`, `Upload failed`, a rejected
record operation, or progress that stops before completion—even if the process
exit code is `0`.

After a successful upload, restart the `gcp-nexus` development site. Then open
the site in a hard-refresh or incognito session and smoke-test the affected
workflow using each relevant role. Do not treat the deployment as verified
until the restart and signed-in smoke test are complete.

`https://gcp-nexus.powerappsportals.com/`
