import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const directory = new URL('../.powerpages-site/table-permissions/', import.meta.url);
const authenticatedRole = 'a479817d-fa2b-43f4-9838-3a5a8d2a2b07';
const adminRole = 'f48675b4-13bf-459d-8a1d-f9a42f468dba';
const scalar = (yaml: string, key: string) => yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
const permissions = () => readdirSync(directory).filter((name) => name.endsWith('.yml'))
  .map((name) => readFileSync(new URL(name, directory), 'utf8'));

test('ordinary authenticated users cannot bypass authorized booking mutations via table writes', () => {
  for (const source of permissions()) {
    if (!['gcp_engagements', 'gcp_slot'].includes(scalar(source, 'entitylogicalname') ?? '')) continue;
    if (!source.includes(authenticatedRole)) continue;
    assert.equal(scalar(source, 'read'), 'true');
    for (const privilege of ['create', 'write', 'delete', 'append', 'appendto']) {
      assert.equal(scalar(source, privilege), 'false', `${scalar(source, 'entityname')}: ${privilege}`);
    }
  }
});

test('administrators retain slot management and engagement detach/restore access', () => {
  for (const table of ['gcp_slot', 'gcp_engagements']) {
    const grants = permissions().filter((source) => scalar(source, 'entitylogicalname') === table && source.includes(adminRole));
    for (const privilege of ['read', 'write', 'append']) {
      assert.ok(grants.some((source) => scalar(source, privilege) === 'true'), `${table}: ${privilege}`);
    }
    if (table === 'gcp_slot') {
      for (const privilege of ['create', 'appendto', 'delete']) {
        assert.ok(grants.some((source) => scalar(source, privilege) === 'true'), `${table}: ${privilege}`);
      }
    }
  }
});
