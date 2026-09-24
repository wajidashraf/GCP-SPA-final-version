import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ADMIN_ROLE_ID = 'f48675b4-13bf-459d-8a1d-f9a42f468dba';

const permissions = [
  ['RTP-Request-Admin-Delete', 'gcp_rtprequest'],
  ['PBL-Request-Admin-Delete', 'gcp_pblrequest'],
  ['JVP-Request-Admin-Delete', 'gcp_jvmrequest'],
  ['STSP-Request-Admin-Delete', 'gcp_stsprequest'],
  ['CAA-Request-Admin-Delete', 'gcp_caarequest'],
  ['PCCA-Request-Admin-Delete', 'gcp_pccarequest'],
  ['PP-Request-Admin-Delete', 'gcp_pprequest'],
  ['VAP-Request-Admin-Delete', 'gcp_vaprequest'],
  ['Other-Request-Admin-Delete', 'gcp_otherrequests'],
  ['RPCCA-Request-Admin-Delete', 'gcp_rpccarequestgcp'],
  ['RPP-Request-Admin-Delete', 'gcp_rpprequest'],
  ['CI-Request-Admin-Delete', 'gcp_requestcigcp'],
  ['CPR-Request-Admin-Delete', 'gcp_cprrequestgcp'],
  ['PBL-Bidders-Admin-Delete', 'gcp_pblbidders'],
] as const;

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

test('grants Administrator delete access to the parent request', () => {
  const source = readRepositoryFile(
    '.powerpages-site/table-permissions/Request-Admin-Global-Access.tablepermission.yml',
  );

  assert.equal(readYamlScalar(source, 'delete'), 'true');
});

test('grants only Administrator global read/delete access to scoped child tables', () => {
  for (const [stem, logicalName] of permissions) {
    const source = readRepositoryFile(
      `.powerpages-site/table-permissions/${stem}.tablepermission.yml`,
    );
    assert.equal(readYamlScalar(source, 'entitylogicalname'), logicalName, stem);
    assert.equal(readYamlScalar(source, 'read'), 'true', stem);
    assert.equal(readYamlScalar(source, 'delete'), 'true', stem);
    assert.equal(readYamlScalar(source, 'create'), 'false', stem);
    assert.equal(readYamlScalar(source, 'write'), 'false', stem);
    assert.equal(readYamlScalar(source, 'append'), 'false', stem);
    assert.equal(readYamlScalar(source, 'appendto'), 'false', stem);
    assert.equal(readYamlScalar(source, 'scope'), '756150000', stem);
    assert.deepEqual(
      [...source.matchAll(/^- ([0-9a-f-]{36})$/gim)].map((match) => match[1]),
      [ADMIN_ROLE_ID],
      stem,
    );
  }
});

test('removes legacy authenticated-user delete access from PBL bidders', () => {
  const source = readRepositoryFile(
    '.powerpages-site/table-permissions/PBL-Bidders-Global-Access.tablepermission.yml',
  );

  assert.equal(readYamlScalar(source, 'entitylogicalname'), 'gcp_pblbidders');
  assert.equal(readYamlScalar(source, 'delete'), 'false');
  assert.deepEqual(
    [...source.matchAll(/^- ([0-9a-f-]{36})$/gim)].map((match) => match[1]),
    ['a479817d-fa2b-43f4-9838-3a5a8d2a2b07'],
  );
});
