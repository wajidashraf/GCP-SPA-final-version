import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as signatureService from '../src/shared/services/signatureService.ts';
import type {
  CreateSignatureInput,
  GcpSignature,
  SignatureConfirmationIo,
} from '../src/shared/services/signatureService.ts';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';

const signature = (
  overrides: Partial<GcpSignature> = {},
): GcpSignature => ({
  id: '44444444-4444-4444-8444-444444444444',
  requestId: OTHER_REQUEST_ID,
  signatoryEmail: 'member@example.com',
  signatoryContactId: CONTACT_ID,
  signatoryName: 'Committee Member',
  signUrl: 'https://sharepoint.example/signature.png',
  createdOn: '2026-09-08T08:00:00Z',
  ...overrides,
});

test('builds a newest reusable-signature query using contact identity with legacy email fallback', () => {
  const query = signatureService.buildLatestReusableSignatureQuery({
    requestId: REQUEST_ID,
    signatoryEmail: " O'Neil@Example.com ",
    signatoryContactId: CONTACT_ID,
  });
  const params = new URLSearchParams(query.slice(1));

  assert.equal(
    params.get('$select'),
    'gcp_signatureid,gcp_name,gcp_signurl,createdon,_gcp_signatory_value,_gcp_request_value',
  );
  assert.equal(
    params.get('$filter'),
    `_gcp_request_value ne ${REQUEST_ID} and gcp_signurl ne null and gcp_signurl ne '' and ((_gcp_signatory_value eq ${CONTACT_ID}) or (_gcp_signatory_value eq null and gcp_name eq 'o''neil@example.com'))`,
  );
  assert.equal(params.get('$orderby'), 'createdon desc');
  assert.equal(params.get('$top'), '10');
});

test('falls back to normalized email when no contact identity is available', () => {
  const query = signatureService.buildLatestReusableSignatureQuery({
    requestId: REQUEST_ID,
    signatoryEmail: ' MEMBER@EXAMPLE.COM ',
    signatoryContactId: null,
  });
  const params = new URLSearchParams(query.slice(1));

  assert.equal(
    params.get('$filter'),
    `_gcp_request_value ne ${REQUEST_ID} and gcp_signurl ne null and gcp_signurl ne '' and gcp_name eq 'member@example.com'`,
  );
});

test('builds an HOC reusable-signature query using contact identity only', () => {
  const query = signatureService.buildLatestReusableSignatureQuery({
    requestId: REQUEST_ID,
    signatoryEmail: 'HOC',
    signatoryContactId: CONTACT_ID,
  });
  const params = new URLSearchParams(query.slice(1));

  assert.equal(
    params.get('$filter'),
    `_gcp_request_value ne ${REQUEST_ID} and gcp_signurl ne null and gcp_signurl ne '' and (_gcp_signatory_value eq ${CONTACT_ID} and gcp_name eq 'HOC')`,
  );
});

test('rejects the HOC marker when no contact identity is available', () => {
  assert.throws(
    () =>
      signatureService.buildLatestReusableSignatureQuery({
        requestId: REQUEST_ID,
        signatoryEmail: 'HOC',
        signatoryContactId: null,
      }),
    /valid signatory contact/i,
  );
});

test('confirms a saved image by creating a new current-request signature event', async () => {
  const input: CreateSignatureInput = {
    requestId: REQUEST_ID,
    signatoryEmail: 'member@example.com',
    signatoryContactId: CONTACT_ID,
    signUrl: 'https://sharepoint.example/signature.png',
  };
  let createdInput: CreateSignatureInput | null = null;
  const io: SignatureConfirmationIo = {
    listForRequest: async () => [],
    create: async (value) => {
      createdInput = value;
      return '55555555-5555-4555-8555-555555555555';
    },
  };

  assert.deepEqual(
    await signatureService.confirmReusableSignature(input, io),
    {
      signatureId: '55555555-5555-4555-8555-555555555555',
      alreadySigned: false,
    },
  );
  assert.deepEqual(createdInput, input);
});

test('treats a repeated confirmation as complete without creating a duplicate row', async () => {
  const input: CreateSignatureInput = {
    requestId: REQUEST_ID,
    signatoryEmail: 'member@example.com',
    signatoryContactId: CONTACT_ID,
    signUrl: 'https://sharepoint.example/signature.png',
  };
  let createCalls = 0;
  const existing = signature({
    requestId: REQUEST_ID,
    signatoryEmail: ' MEMBER@EXAMPLE.COM ',
  });
  const io: SignatureConfirmationIo = {
    listForRequest: async () => [existing],
    create: async () => {
      createCalls += 1;
      return 'unexpected';
    },
  };

  assert.deepEqual(
    await signatureService.confirmReusableSignature(input, io),
    { signatureId: existing.id, alreadySigned: true },
  );
  assert.equal(createCalls, 0);
});

test('matches repeated HOC confirmation by marker and contact identity', async () => {
  const input: CreateSignatureInput = {
    requestId: REQUEST_ID,
    signatoryEmail: 'HOC',
    signatoryContactId: CONTACT_ID,
    signUrl: 'https://sharepoint.example/signature.png',
  };
  const otherContact = '66666666-6666-4666-8666-666666666666';
  const matching = signature({
    requestId: REQUEST_ID,
    signatoryEmail: 'HOC',
    signatoryContactId: CONTACT_ID,
  });
  let createCalls = 0;
  const io: SignatureConfirmationIo = {
    listForRequest: async () => [
      signature({
        id: '77777777-7777-4777-8777-777777777777',
        requestId: REQUEST_ID,
        signatoryEmail: 'HOC',
        signatoryContactId: otherContact,
      }),
      matching,
    ],
    create: async () => {
      createCalls += 1;
      return 'unexpected';
    },
  };

  assert.deepEqual(
    await signatureService.confirmReusableSignature(input, io),
    { signatureId: matching.id, alreadySigned: true },
  );
  assert.equal(createCalls, 0);
});

test('does not treat another contact HOC signature as the current signer confirmation', async () => {
  const input: CreateSignatureInput = {
    requestId: REQUEST_ID,
    signatoryEmail: 'HOC',
    signatoryContactId: CONTACT_ID,
    signUrl: 'https://sharepoint.example/signature.png',
  };
  let createdInput: CreateSignatureInput | null = null;
  const io: SignatureConfirmationIo = {
    listForRequest: async () => [
      signature({
        requestId: REQUEST_ID,
        signatoryEmail: 'HOC',
        signatoryContactId: '66666666-6666-4666-8666-666666666666',
      }),
    ],
    create: async (value) => {
      createdInput = value;
      return '88888888-8888-4888-8888-888888888888';
    },
  };

  assert.deepEqual(
    await signatureService.confirmReusableSignature(input, io),
    {
      signatureId: '88888888-8888-4888-8888-888888888888',
      alreadySigned: false,
    },
  );
  assert.deepEqual(createdInput, input);
});

test('does not treat a matching row with an empty image as confirmed', async () => {
  const input: CreateSignatureInput = {
    requestId: REQUEST_ID,
    signatoryEmail: 'HOC',
    signatoryContactId: CONTACT_ID,
    signUrl: 'https://sharepoint.example/signature.png',
  };
  let createdInput: CreateSignatureInput | null = null;
  const io: SignatureConfirmationIo = {
    listForRequest: async () => [
      signature({
        requestId: REQUEST_ID,
        signatoryEmail: 'HOC',
        signatoryContactId: CONTACT_ID,
        signUrl: '   ',
      }),
    ],
    create: async (value) => {
      createdInput = value;
      return '99999999-9999-4999-8999-999999999999';
    },
  };

  assert.deepEqual(
    await signatureService.confirmReusableSignature(input, io),
    {
      signatureId: '99999999-9999-4999-8999-999999999999',
      alreadySigned: false,
    },
  );
  assert.deepEqual(createdInput, input);
});

test('keeps a current-request signature authoritative over a reusable preview', () => {
  assert.equal(
    signatureService.getSignatureBoxState(
      signature({ requestId: REQUEST_ID }),
      signature(),
    ),
    'signed',
  );
});

test('shows a reusable image as unconfirmed and treats a missing image as empty', () => {
  assert.equal(
    signatureService.getSignatureBoxState(undefined, signature()),
    'reusable',
  );
  assert.equal(
    signatureService.getSignatureBoxState(
      undefined,
      signature({ signUrl: null }),
    ),
    'empty',
  );
  assert.equal(
    signatureService.getSignatureBoxState(undefined, null),
    'empty',
  );
});

test('treats only a non-empty signature URL as a usable signature', () => {
  assert.equal(signatureService.isUsableSignature(signature()), true);
  assert.equal(
    signatureService.isUsableSignature(signature({ signUrl: '   ' })),
    false,
  );
  assert.equal(
    signatureService.isUsableSignature(signature({ signUrl: null })),
    false,
  );
  assert.equal(signatureService.isUsableSignature(undefined), false);
});

test('selects the latest usable signature from newest-first rows', () => {
  const usable = signature({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    signUrl: 'https://sharepoint.example/usable.png',
  });
  assert.equal(
    signatureService.findLatestUsableSignature([
      signature({ signUrl: ' ' }),
      usable,
      signature({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    ]),
    usable,
  );
});

test('signature create permission includes the HOC role', async () => {
  const permission = await readFile(
    new URL(
      '../.powerpages-site/table-permissions/Signature-Signatory-Write.tablepermission.yml',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(permission, /create:\s*true/);
  assert.match(permission, /7a1e229c-567b-4bbf-ae02-522e59efcff2/);
});

test('HOC company-scoped request permission allows signature association', async () => {
  const permission = await readFile(
    new URL(
      '../.powerpages-site/table-permissions/Request-HOC-Company-Read.tablepermission.yml',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(permission, /scope:\s*756150002/);
  assert.match(permission, /appendto:\s*true/);
});
