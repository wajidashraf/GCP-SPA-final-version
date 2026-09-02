import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ENDORSEMENT_ROUTE_ROLES,
  canSubmitEndorsement,
  formatEndorsementSubmissionError,
  isEndorsementSourceStatus,
  submitEndorsementWithReconciliation,
} from '../src/shared/endorsementSubmission.ts';

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

test('allows only Endorser or Administrator at endorsement source statuses', () => {
  const cases = [
    { status: 11, actor: { isAdmin: false, isEndorser: true }, want: true },
    { status: 8, actor: { isAdmin: true, isEndorser: false }, want: true },
    {
      status: 11,
      actor: { isAdmin: false, isEndorser: false, isReviewer: true },
      want: false,
    },
    { status: 11, actor: { isAdmin: false, isEndorser: false }, want: false },
    { status: 12, actor: { isAdmin: true, isEndorser: false }, want: false },
  ] as const;

  for (const item of cases) {
    assert.equal(
      canSubmitEndorsement(item.status, item.actor),
      item.want,
      `status ${item.status}, actor ${JSON.stringify(item.actor)}`,
    );
  }
});

test('recognizes Pending Endorse and legacy Complete Acceptance only', () => {
  assert.equal(isEndorsementSourceStatus(11), true);
  assert.equal(isEndorsementSourceStatus(8), true);
  assert.equal(isEndorsementSourceStatus(12), false);
  assert.equal(isEndorsementSourceStatus(null), false);
});

test('publishes the route roles consumed by the route guard', () => {
  assert.deepEqual(ENDORSEMENT_ROUTE_ROLES, ['Administrators', 'Endorser']);
});

test('Endorser has the existing global request workflow write permission', () => {
  const permission = readRepositoryFile(
    '.powerpages-site/table-permissions/Request-Reviewer-Verifier-Write.tablepermission.yml',
  );

  assert.equal(readYamlScalar(permission, 'entitylogicalname'), 'gcp_request');
  assert.equal(readYamlScalar(permission, 'write'), 'true');
  assert.equal(
    readYamlScalar(permission, 'id'),
    '4f2a9c1e-8b3d-4e67-a5f2-9c8d1e2f3a4b',
  );
  assert.equal(readYamlScalar(permission, 'scope'), '756150000');
  assert.match(
    permission,
    /^- 712bfc10-3359-4685-8f1f-69cd1db4f91a$/m,
  );
});

test('reconciles an uncertain lost response when Endorsed status is observable', async () => {
  assert.equal(
    await submitEndorsementWithReconciliation({
      submit: async () => {
        throw new TypeError('Failed to fetch');
      },
      confirm: async () => true,
    }),
    'reconciled',
  );
});

test('does not turn a deterministic permission failure into success', async () => {
  const permissionError = Object.assign(new Error('Forbidden'), { status: 403 });
  let confirmCalled = false;

  await assert.rejects(
    submitEndorsementWithReconciliation({
      submit: async () => {
        throw permissionError;
      },
      confirm: async () => {
        confirmCalled = true;
        return true;
      },
    }),
    (error) => error === permissionError,
  );
  assert.equal(confirmCalled, false);
});

test('rethrows an uncertain error when Endorsed status cannot be confirmed', async () => {
  const networkError = new TypeError('Failed to fetch');
  await assert.rejects(
    submitEndorsementWithReconciliation({
      submit: async () => {
        throw networkError;
      },
      confirm: async () => false,
    }),
    (error) => error === networkError,
  );
});

test('returns ordinary submission when the PATCH succeeds', async () => {
  assert.equal(
    await submitEndorsementWithReconciliation({
      submit: async () => undefined,
      confirm: async () => false,
    }),
    'submitted',
  );
});

test('formats blank and permission endorsement errors into actionable messages', () => {
  assert.equal(
    formatEndorsementSubmissionError(new Error('   ')),
    'The endorsement could not be submitted. Please try again.',
  );
  assert.equal(
    formatEndorsementSubmissionError(
      Object.assign(new Error('Request failed (HTTP 403).'), { status: 403 }),
    ),
    'You do not have permission to submit this endorsement (HTTP 403).',
  );
  assert.equal(
    formatEndorsementSubmissionError(new Error('Dataverse validation failed')),
    'Dataverse validation failed',
  );
});
