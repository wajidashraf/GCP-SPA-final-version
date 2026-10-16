import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { inventoryWebApiColumns, tableSources, unsupportedWebApiExpansions } from './webApiColumnInventory.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const scalar = (source: string, key: string) =>
  source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
const settings = readdirSync(new URL('.powerpages-site/site-settings/', root))
  .filter((name) => name.endsWith('.yml'))
  .map((name) => read(`.powerpages-site/site-settings/${name}`));
const fieldsFor = (table: string) => new Set(
  (scalar(settings.find((source) => scalar(source, 'name') === `Webapi/${table}/fields`) ?? '', 'value') ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean),
);

test('every enabled Web API table has an explicit column list after wildcard retirement', () => {
  const invalid: string[] = [];
  for (const source of settings) {
    const name = scalar(source, 'name');
    if (!name?.match(/^Webapi\/[^/]+\/enabled$/) || scalar(source, 'value') !== 'true') continue;
    const table = name.split('/')[1];
    const fields = fieldsFor(table);
    if (!fields.size || fields.has('*') || [...fields].some((field) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field))) {
      invalid.push(table);
    }
  }
  assert.deepEqual(invalid, [], 'These enabled tables would reject requests with the retired wildcard configuration.');
});

test('lookup writes allow the exact navigation property rather than only its lower-case logical column', () => {
  const request = read('src/shared/services/requestService.ts');
  const key = [...request.matchAll(/out\['([^']+)@odata\.bind'\]/g)]
    .map((match) => match[1]).find((field) => field === 'gcp_RequestorName');
  assert.equal(key, 'gcp_RequestorName', 'The regression exercises the actual request submission bind.');
  assert.ok(fieldsFor('gcp_request').has(key), `${key} is sent on request creation but is not enabled.`);
});

const tableTypes = {
  account: 'account', contact: 'contact', gcp_request: 'request',
  gcp_projects: 'project', gcp_engagements: 'engagement', gcp_slot: 'slot',
  gcp_emailtemplate: 'emailTemplate', gcp_rtprequest: 'rtpRequest',
  gcp_pblrequest: 'pblRequest', gcp_pblbidders: 'pblBidder',
  gcp_jvmrequest: 'jvpRequest', gcp_stsprequest: 'stspRequest',
  gcp_caarequest: 'caaRequest', gcp_pccarequest: 'pccaRequest',
  gcp_pprequest: 'ppRequest', gcp_vaprequest: 'vapRequest',
  gcp_otherrequests: 'otherRequest', gcp_cprrequestgcp: 'cprRequest',
  gcp_requestcigcp: 'ciRequest', gcp_rpccarequestgcp: 'rpccaRequest',
  gcp_rpprequest: 'rppRequest',
};

const selectedColumns = (path: string): string[] => {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  const columns = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /SELECT$/.test(node.name.text)) {
      let value = node.initializer;
      while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))) {
        value = value.expression;
      }
      if (value && ts.isArrayLiteralExpression(value)) {
        for (const element of value.elements) if (ts.isStringLiteral(element)) columns.add(element.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...columns];
};

test('column allow lists cover the actual default projections used by every typed table service', () => {
  const missing: string[] = [];
  for (const [table, type] of Object.entries(tableTypes)) {
    const selected = selectedColumns(`src/types/${type}.ts`);
    assert.ok(selected.length, `${table} has an actual projection to verify`);
    for (const column of selected) if (!fieldsFor(table).has(column)) missing.push(`${table}.${column}`);
  }
  assert.deepEqual(missing, [], 'A real default service query would request a disallowed column.');
});

test('the reported request-list projection and secondary review/history reads remain allowed', () => {
  const fields = fieldsFor('gcp_request');
  const source = read('src/shared/services/requestService.ts');
  const columns = new Set(selectedColumns('src/types/request.ts'));
  for (const match of source.matchAll(/\$select=([a-z0-9_,]+)/g)) {
    for (const column of match[1].split(',')) columns.add(column);
  }
  assert.deepEqual([...columns].filter((column) => !fields.has(column)), []);
});

const inventory = inventoryWebApiColumns();

test('source audit covers each table service and real payloads including dynamic attendee association and clearing', () => {
  const registered = new Set(Object.values(tableSources).map((stem) => `${stem}Service.ts`));
  const services = readdirSync(new URL('src/shared/services/', root))
    .filter((file) => /const ENTITY_SET = /.test(read(`src/shared/services/${file}`)));
  assert.deepEqual(services.filter((file) => !registered.has(file)), [], 'Register new table services in the source audit.');
  const written = new Set(inventory.filter((use) => use.kind === 'write').map((use) => `${use.table}.${use.column}`));
  for (const column of [
    'gcp_request.gcp_RequestorName', 'gcp_request.gcp_Reviewedby',
    'gcp_request.gcp_project_name', 'gcp_request.gcp_requestoremail',
    'gcp_rtprequest.gcp_client_name_text', 'gcp_pblbidders.gcp_pblbiddername',
    'gcp_engagements.gcp_Slot', 'gcp_signature.gcp_Signatory',
    'gcp_slot.gcp_Attendee', 'gcp_slot.gcp_Attendee_1', 'gcp_slot.gcp_Attendee_2',
  ]) assert.ok(written.has(column), `Audit must inspect actual write ${column}.`);
  for (const column of ['gcp_Attendee', 'gcp_Attendee_1', 'gcp_Attendee_2']) {
    assert.ok(inventory.some((use) => use.table === 'gcp_slot' && use.column === column &&
      use.kind === 'write' && read(use.source).split(/\r?\n/)[use.line - 1].includes('ATTENDEE_NAV_PROPS')),
    `Dynamic ${column} bind and null-unbind use the exact navigation property.`);
  }
  for (const [table, stem] of Object.entries(tableTypes)) {
    for (const column of selectedColumns(`src/types/${stem}.ts`)) {
      assert.ok(inventory.some((use) => use.table === table && use.column === column && use.kind !== 'contract'),
        `The executable inventory must include the actual ${table}.${column} projection.`);
    }
  }
});

test('column allow lists cover actual service and caller writes plus supplementary selects, filters, and ordering', () => {
  const missing = new Set(inventory.filter((use) => use.kind !== 'contract' && !fieldsFor(use.table).has(use.column))
    .map((use) => `${use.table}.${use.column} (${use.source}:${use.line})`));
  assert.deepEqual([...missing], [], 'Executable Web API requests contain disallowed columns; navigation property case is significant.');
});

test('unused optional input contracts do not silently enable display-only form fields', () => {
  for (const [table, column] of [
    ['gcp_request', 'gcp_notes'],
    ['gcp_rtprequest', 'gcp_verifiercomments'],
    ['gcp_stsprequest', 'gcp_resourcescontribution'],
  ]) {
    assert.ok(inventory.some((use) => use.table === table && use.column === column && use.kind === 'contract'));
    assert.ok(!inventory.some((use) => use.table === table && use.column === column && use.kind !== 'contract'));
  }
});

test('new related-table expansions require an audit scoped to the navigation target', () => {
  assert.deepEqual(unsupportedWebApiExpansions(), [], 'Add related-table column attribution before introducing $expand requests.');
});

test('request permissions preserve global trusted-role reads and contact-scoped requestor reads', () => {
  const permissionDirectory = new URL('.powerpages-site/table-permissions/', root);
  const grants = readdirSync(permissionDirectory)
    .filter((name) => name.endsWith('.yml'))
    .map((name) => readFileSync(new URL(name, permissionDirectory), 'utf8'))
    .filter((source) => scalar(source, 'entitylogicalname') === 'gcp_request' && scalar(source, 'read') === 'true');
  const authenticated = 'a479817d-fa2b-43f4-9838-3a5a8d2a2b07';
  const requestor = '063d366d-4b7c-4bae-8651-2e98f1515013';
  const admin = 'f48675b4-13bf-459d-8a1d-f9a42f468dba';
  const reviewer = 'b079a542-bca0-43b7-a964-642298845ba1';
  const verifier = 'a9024323-2bc2-4fc9-b7cf-aafb69581168';
  for (const role of [admin, reviewer, verifier]) {
    assert.ok(grants.some((source) => source.includes(`- ${role}`) && scalar(source, 'scope') === '756150000'));
  }
  for (const source of grants.filter((grant) => grant.includes(`- ${authenticated}`) || grant.includes(`- ${requestor}`))) {
    assert.equal(scalar(source, 'scope'), '756150001', 'Ordinary users must never receive Global request read.');
    assert.equal(scalar(source, 'contactrelationship'), 'gcp_request_RequestorName_contact');
  }
  assert.ok(grants.some((source) => source.includes(`- ${authenticated}`)));
});
