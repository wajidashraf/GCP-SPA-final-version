import assert from 'node:assert/strict';
import test from 'node:test';
import { invalidateAntiForgeryToken } from '../src/shared/powerPagesApi.ts';
import { listSignaturesForRequest } from '../src/shared/services/signatureService.ts';

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('loads every request-scoped signature page through same-origin authenticated GETs', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  Object.assign(globalThis, { window: { location: { origin: 'https://portal.example' } } });
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    assert.equal(init?.credentials, 'same-origin');
    if (path === '/_layout/tokenhtml') return new Response('<input value="test-token" />');
    assert.equal(init?.method, 'GET');
    assert.equal(new Headers(init?.headers).get('__RequestVerificationToken'), 'test-token');
    paths.push(path);
    const row = (id: string) => ({
      gcp_signatureid: id, gcp_name: 'former.member@example.com',
      gcp_signurl: 'https://example.sharepoint.com/saved.png',
      _gcp_request_value: REQUEST_ID, createdon: '2026-10-14T10:00:00Z',
    });
    return Response.json(paths.length === 1
      ? { value: [row('one')], '@odata.nextLink': 'https://portal.example/_api/gcp_signatures?$skiptoken=two' }
      : { value: [row('two')] });
  };
  invalidateAntiForgeryToken();
  try {
    const rows = await listSignaturesForRequest(REQUEST_ID);
    assert.deepEqual(rows.map((row) => row.id), ['one', 'two']);
    assert.equal(new URL(paths[0], 'https://portal.example').searchParams.get('$filter'), `_gcp_request_value eq ${REQUEST_ID}`);
    assert.equal(paths[1], '/_api/gcp_signatures?$skiptoken=two');
  } finally {
    globalThis.fetch = previousFetch;
    Object.assign(globalThis, { window: previousWindow });
    invalidateAntiForgeryToken();
  }
});

test('rejects a malformed request ID before starting signature reads', async () => {
  await assert.rejects(listSignaturesForRequest('not-a-guid'), /valid request ID/i);
});
