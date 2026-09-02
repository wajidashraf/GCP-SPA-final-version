# Project Web API Logical-Name Correction Design

**Date:** 2026-08-25  
**Status:** Approved for implementation planning

## Problem

The Project lookup works in GCP-Developer, but production requires manually
changing the Project Power Pages Web API site-setting keys from `gcp_project`
to `gcp_projects` after deployment.

Repository metadata identifies `gcp_projects` as the Project table logical name:

- `.powerpages-site/table-permissions/Project-Global-Access.tablepermission.yml`
  uses `entitylogicalname: gcp_projects`.
- The frontend correctly calls the separate Dataverse entity-set name
  `gcp_projectses` through `src/shared/services/projectService.ts`.

The two checked-in Project site settings incorrectly use the singular logical
name `gcp_project`. Power Pages site-setting keys require the table logical name,
while API URLs require the entity-set name.

## Design

Correct the existing Project Web API settings in place:

- `Webapi/gcp_project/enabled` becomes `Webapi/gcp_projects/enabled`.
- `Webapi/gcp_project/fields` becomes `Webapi/gcp_projects/fields`.
- Preserve both existing site-setting record IDs so PAC updates the same
  records instead of creating duplicate settings.
- Keep the frontend endpoint `/_api/gcp_projectses` unchanged.
- Update comments and mapping documentation that incorrectly identify the
  Project logical name as `gcp_project`.
- Do not change Dataverse tables, columns, relationships, permissions, choice
  values, or entity-set names.

## Regression Protection

Add a focused repository test that reads the checked-in Power Pages metadata
and verifies:

1. The Project table permission uses `gcp_projects`.
2. The enabled and fields site-setting keys use that same logical name.
3. Build and diff verification confirm that the frontend Project service still
   uses `gcp_projectses` as its API entity set.

Run the focused test first and confirm it fails against the current singular
settings. Apply the minimal metadata/documentation correction, rerun the test,
then run the existing focused tests and the production SPA build.

## Deployment Boundary

Preparation does not upload or restart production. Before an upload, PAC must
successfully authenticate to and verify the documented `PowerPagesProduction`
environment, list `gcp-nexus` as the intended active Enhanced-model SPA, and
pass the repository's manifest checks. Production upload and restart each
require explicit confirmation.
