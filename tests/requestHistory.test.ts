import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStoredLetterText } from '../src/components/letters/letterPersistence.ts';
import {
  collectRequestPages,
  getAcceptanceHistory,
  getRequestSignatureEvents,
  normalizeRequestNextLink,
} from '../src/shared/requestHistory.ts';
import type { GcpSignature } from '../src/shared/services/signatureService.ts';

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event = (overrides: Partial<GcpSignature> = {}): GcpSignature => ({
  id: 'event-one',
  requestId: REQUEST_ID,
  signatoryEmail: 'former.member@example.com',
  signatoryContactId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  signatoryName: 'Stored member',
  signUrl: 'https://example.sharepoint.com/signature.png',
  createdOn: '2026-10-14T10:00:00Z',
  ...overrides,
});

test('extracts only a valid V2 suffix and preserves the saved body byte for byte', () => {
  const body = '  Dear <Committee> & team,\n\nSaved wording.  \n';
  assert.equal(extractStoredLetterText(`${body}\n\nGCP_LETTER_METADATA_V2:{"templateKey":"ack-v1","values":{"name":"A"}}`), body);
});

test('extracts a valid legacy suffix without interpreting saved text as HTML', () => {
  assert.equal(extractStoredLetterText('<b>Saved</b>\n\n<!--GCP_LETTER:{"templateKey":"old","values":{}}-->'), '<b>Saved</b>');
});

test('preserves plain text, malformed payloads, and markers embedded in the body', () => {
  for (const raw of [
    'Plain\ntext  ',
    'Body\n\nGCP_LETTER_METADATA_V2:not-json',
    'Body\n\nGCP_LETTER_METADATA_V2:{"templateKey":"x","values":[]}',
    'Body\n\nGCP_LETTER_METADATA_V2:{"templateKey":"x","values":{"x":4}}',
    'Body\n\nGCP_LETTER_METADATA_V2:{"templateKey":4,"values":{}}',
    'Body\n\n<!--GCP_LETTER:{"templateKey":"x","values":{}}-->\nMore saved text',
    'Body\n\n<!--GCP_LETTER:{"templateKey":"x"}',
  ]) assert.equal(extractStoredLetterText(raw), raw);
  assert.equal(extractStoredLetterText(null), '');
  assert.equal(extractStoredLetterText(undefined), '');
});

test('does not manufacture acceptance from workflow status or default false flags', () => {
  assert.equal(getAcceptanceHistory({ acceptanceDate: null, reviewCode1a: false, reviewCode1b: false, reviewCode2: false, reviewCode3: false, reviewCode1bComment: null }), null);
});

test('retains each saved acceptance flag, legacy comment, and date without merging legacy code 1b', () => {
  assert.deepEqual(getAcceptanceHistory({
    acceptanceDate: '2026-10-14T10:30:00Z', reviewCode1a: true, reviewCode1b: true,
    reviewCode2: false, reviewCode3: null, reviewCode1bComment: 'Exact legacy comment\nwith lines.',
  }), {
    date: '2026-10-14T10:30:00Z', conclusionCodes: ['1(a)', '1(b)'],
    legacyComment: 'Exact legacy comment\nwith lines.',
  });
});

test('shows saved acceptance dates even when the legacy conclusion is unavailable', () => {
  assert.deepEqual(getAcceptanceHistory({ acceptanceDate: '2026-10-14', reviewCode1bComment: null }), {
    date: '2026-10-14', conclusionCodes: [], legacyComment: null,
  });
});

test('keeps all usable request-linked signing events independently of roster and recognizes stored HOC markers', () => {
  const rows = [
    event(),
    event({ id: 'event-two', signatoryEmail: 'former.member@example.com' }),
    event({ id: 'hoc-event', signatoryEmail: ' HOC ', signatoryName: null }),
    event({ id: 'preview', requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    event({ id: 'empty', signUrl: '  ' }),
    event({ id: 'unlinked', requestId: null }),
  ];
  const events = getRequestSignatureEvents(REQUEST_ID.toUpperCase(), rows);
  assert.deepEqual(events.map((row) => [row.signature.id, row.kind]), [
    ['event-one', 'signatory'], ['event-two', 'signatory'], ['hoc-event', 'hoc'],
  ]);
  assert.equal(events[2].identity, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.equal(events[0].signature.createdOn, '2026-10-14T10:00:00Z');
});

test('collects every child or bidder page using same-origin continuation URLs', async () => {
  const seen: (string | undefined)[] = [];
  const rows = await collectRequestPages(async (nextLink) => {
    seen.push(nextLink);
    if (!nextLink) return { items: ['first'], nextLink: 'https://portal.example/_api/gcp_pblbidderses?$skiptoken=next' };
    return { items: ['second', 'third'] };
  }, 'https://portal.example');
  assert.deepEqual(rows, ['first', 'second', 'third']);
  assert.deepEqual(seen, [undefined, '/_api/gcp_pblbidderses?$skiptoken=next']);
});

test('rejects foreign, non-API, and looping nextLinks instead of returning incomplete history', async () => {
  for (const link of ['https://foreign.example/_api/gcp_signatures', '/_layout/tokenhtml', '//foreign.example/_api/gcp_signatures']) {
    assert.throws(() => normalizeRequestNextLink(link, 'https://portal.example'), /same-origin Power Pages/i);
  }
  await assert.rejects(collectRequestPages(async () => ({ items: ['one'], nextLink: '/_api/gcp_signatures?$skiptoken=same' }), 'https://portal.example'), /repeated/i);
});
