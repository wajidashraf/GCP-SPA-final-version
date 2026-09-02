import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryPath = (relativePath: string): string =>
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const readRepositoryFile = (relativePath: string): string =>
  readFileSync(repositoryPath(relativePath), 'utf8');

const readYamlScalar = (source: string, key: string): string => {
  const match = source.match(
    new RegExp(`^${key}:\\s*['"]?([^'"\\r\\n]+)['"]?\\s*$`, 'm'),
  );
  assert.ok(match, `Expected ${key} in YAML metadata`);
  return match[1].trim();
};

test('Project Web API settings use the table-permission logical name', () => {
  const permission = readRepositoryFile(
    '.powerpages-site/table-permissions/Project-Global-Access.tablepermission.yml',
  );
  const logicalName = readYamlScalar(permission, 'entitylogicalname');
  assert.equal(logicalName, 'gcp_projects');

  const enabled = readRepositoryFile(
    '.powerpages-site/site-settings/Webapi-gcp_project-enabled.sitesetting.yml',
  );
  const fields = readRepositoryFile(
    '.powerpages-site/site-settings/Webapi-gcp_project-fields.sitesetting.yml',
  );

  assert.equal(
    readYamlScalar(enabled, 'name'),
    `Webapi/${logicalName}/enabled`,
  );
  assert.equal(
    readYamlScalar(fields, 'name'),
    `Webapi/${logicalName}/fields`,
  );
});
