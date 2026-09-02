import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invalidateAntiForgeryToken,
  powerPagesFetch,
  WebApiError,
} from '../src/shared/powerPagesApi.ts';

const requestWithResponse = async (response: Response): Promise<WebApiError> => {
  const originalFetch = globalThis.fetch;
  let call = 0;
  invalidateAntiForgeryToken();
  globalThis.fetch = (async () => {
    call += 1;
    if (call === 1) {
      return new Response('<input value="test-token" />', { status: 200 });
    }
    return response;
  }) as typeof fetch;

  try {
    try {
      await powerPagesFetch('/_api/gcp_requests(test)', {
        method: 'PATCH',
        json: {},
      });
    } catch (error) {
      assert.ok(error instanceof WebApiError);
      return error;
    }
    throw new Error('Expected the Web API request to fail.');
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAntiForgeryToken();
  }
};

test('blank permission responses produce a non-empty HTTP 403 message', async () => {
  const error = await requestWithResponse(new Response('', { status: 403 }));
  assert.match(error.message, /permission/i);
  assert.match(error.message, /HTTP 403/);
});

test('preserves a useful OData error message', async () => {
  const error = await requestWithResponse(
    new Response(
      JSON.stringify({ error: { code: 'X', message: 'Useful detail' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  assert.equal(error.message, 'Useful detail');
  assert.equal(error.code, 'X');
});

test('unwraps a nested Dataverse message value', async () => {
  const error = await requestWithResponse(
    new Response(
      JSON.stringify({
        error: { code: 'X2', message: { value: 'Nested useful detail' } },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  assert.equal(error.message, 'Nested useful detail');
});

test('preserves safe plain-text response details', async () => {
  const error = await requestWithResponse(
    new Response('Gateway rejected request', { status: 400 }),
  );
  assert.equal(error.message, 'Gateway rejected request');
});

test('blank validation responses contain their HTTP status', async () => {
  const error = await requestWithResponse(new Response('', { status: 400 }));
  assert.match(error.message, /HTTP 400/);
});
