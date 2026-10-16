import assert from 'node:assert/strict';
import test from 'node:test';
const statusModule = await import('../dist/src/dataverse/requestStatuses.js').catch(e => {
  if (e.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw e;
});
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const identity = { contactId: id(1), siteId: id(2), dataverseUrl: 'https://test.crm.dynamics.com' };
const role = id(3), requestId = id(4), account = id(5);
const grant = (scope, extra = {}) => ({ entitylogicalname: 'gcp_request', read: true, scope,
  websiteid: identity.siteId, adx_entitypermission_webrole: [role], ...extra });
const access = permissions => ({ roles: [role], permissions, accountId: account });
const policy = (permissions, extra = {}) => {
  assert.equal(typeof statusModule.requestStatusAccessFilter, 'function');
  return statusModule.requestStatusAccessFilter(identity, { ...access(permissions), ...extra });
};
test('global request read is restricted to matching site role grants', () => {
  assert.equal(policy([grant(756150000)]), '');
  assert.equal(policy([grant(756150000, { websiteid: id(99) })]), null);
  assert.equal(policy([grant(756150000)], { roles: [id(90)] }), null);
});
test('authenticated owner access is scoped to the original requestor lookup', () => {
  assert.equal(policy([grant(756150001, { contactrelationship: 'gcp_request_RequestorName_contact' })]), `_gcp_requestorname_value eq ${identity.contactId}`);
});
test('company access only uses the verified company relationship and account ID', () => {
  const permission = grant(756150002, { accountrelationship: 'gcp_request_Company_account' });
  assert.equal(policy([permission]), `_gcp_company_value eq ${account}`);
  assert.equal(policy([permission], { accountId: null }), null);
  assert.equal(policy([grant(756150002, { accountrelationship: 'unverified_relationship' })]), null);
});
test('write-only, unrelated-table, unknown-scope and unverified-contact grants cannot expose status', () => {
  for (const permission of [grant(756150000, { read: false }), grant(756150000, { entitylogicalname: 'gcp_slot' }),
    grant(999), grant(756150001, { contactrelationship: 'unverified_relationship' })]) {
    assert.equal(policy([permission]), null);
  }
});
test('batch returns only requested fresh status values with no identity or document fields', async () => {
  assert.equal(typeof statusModule.readRequestStatuses, 'function');
  const result = await statusModule.readRequestStatuses([requestId], identity, {
    getAccess: async () => access([grant(756150000)]),
    listStatuses: async (ids, filter) => {
      assert.deepEqual(ids, [requestId]); assert.equal(filter, '');
      return [{ gcp_requestid: requestId, gcp_requeststatus: 3, gcp_requestoremail: 'private@example.test' }];
    },
  });
  assert.deepEqual(result, { ok: true, requests: [{ id: requestId, status: 3 }] });
});
test('callers without request read access do not query business records', async () => {
  assert.equal(typeof statusModule.readRequestStatuses, 'function');
  const result = await statusModule.readRequestStatuses([requestId], identity, { getAccess: async () => access([]), listStatuses: assert.fail });
  assert.deepEqual(result.requests, []);
});
test('contact-scoped reads pass the enforced scope filter to the query boundary', async () => {
  assert.equal(typeof statusModule.readRequestStatuses, 'function');
  await statusModule.readRequestStatuses([requestId], identity, {
    getAccess: async () => access([grant(756150001, { contactrelationship: 'gcp_request_RequestorName_contact' })]),
    listStatuses: async (_ids, filter) => { assert.equal(filter, `_gcp_requestorname_value eq ${identity.contactId}`); return []; },
  });
});
test('bad IDs and oversized batches fail before privileged IO', async () => {
  assert.equal(typeof statusModule.readRequestStatuses, 'function');
  for (const ids of [['../contacts'], Array.from({ length: 101 }, (_, i) => id(i + 10))]) {
    await assert.rejects(statusModule.readRequestStatuses(ids, identity, { getAccess: assert.fail, listStatuses: assert.fail }), e => e.status === 400);
  }
});
test('unvalidated contact and missing portal mapping fail before IO', async () => {
  assert.equal(typeof statusModule.readRequestStatuses, 'function');
  for (const invalid of [{ ...identity, contactId: '' }, { ...identity, siteId: '' }]) {
    await assert.rejects(statusModule.readRequestStatuses([requestId], invalid, { getAccess: assert.fail, listStatuses: assert.fail }));
  }
});
