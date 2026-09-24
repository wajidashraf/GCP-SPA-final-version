import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertUploadsReady,
  checkUploadAddition,
  checkUploadReplacement,
  formatQuotaExceededMessage,
  formatUploadBytes,
  getUploadReadiness,
  MAX_REQUEST_UPLOAD_BYTES,
  sumUploadBytes,
} from '../src/shared/uploadQuota.ts';

const MIB = 1024 * 1024;

const uploaded = (size: number) => ({
  file: { size },
  progress: 100,
  url: 'https://sharepoint.example/file',
});

test('allows exactly 100 MiB and rejects one byte more', () => {
  assert.equal(MAX_REQUEST_UPLOAD_BYTES, 100 * MIB);
  assert.deepEqual(
    checkUploadAddition(70 * MIB, 30 * MIB, MAX_REQUEST_UPLOAD_BYTES),
    { allowed: true, nextBytes: 100 * MIB, remainingBytes: 0 },
  );
  assert.deepEqual(
    checkUploadAddition(70 * MIB, 30 * MIB + 1, MAX_REQUEST_UPLOAD_BYTES),
    {
      allowed: false,
      nextBytes: 100 * MIB + 1,
      remainingBytes: 30 * MIB,
    },
  );
});

test('calculates replacement quota after releasing the previous file', () => {
  assert.deepEqual(
    checkUploadReplacement(
      90 * MIB,
      20 * MIB,
      30 * MIB,
      MAX_REQUEST_UPLOAD_BYTES,
    ),
    { allowed: true, nextBytes: 100 * MIB, remainingBytes: 0 },
  );
});

test('sums upload bytes across groups and handles empty groups', () => {
  assert.equal(
    sumUploadBytes([
      [uploaded(10 * MIB)],
      [uploaded(20 * MIB), uploaded(5 * MIB)],
      [],
    ]),
    35 * MIB,
  );
  assert.equal(sumUploadBytes([]), 0);
});

test('reports upload readiness in actionable priority order', () => {
  assert.deepEqual(
    getUploadReadiness([
      [{ file: { size: MIB }, progress: 10 }],
      [{ file: { size: MIB }, progress: 100, error: 'Upload failed' }],
    ]),
    {
      ready: false,
      message: 'Remove or retry failed uploads before submitting.',
    },
  );
  assert.deepEqual(
    getUploadReadiness([[{ file: { size: MIB }, progress: 75 }]]),
    {
      ready: false,
      message: 'Wait for all files to finish uploading before submitting.',
    },
  );
  assert.deepEqual(
    getUploadReadiness([[{ file: { size: MIB }, progress: 100 }]]),
    {
      ready: false,
      message: 'One or more completed uploads is missing its SharePoint link.',
    },
  );
  assert.deepEqual(getUploadReadiness([[uploaded(MIB)]]), {
    ready: true,
    message: null,
  });
  assert.deepEqual(getUploadReadiness([]), { ready: true, message: null });
});

test('assertUploadsReady throws the exact readiness message', () => {
  assert.throws(
    () => assertUploadsReady([[{ file: { size: MIB }, progress: 50 }]]),
    new Error('Wait for all files to finish uploading before submitting.'),
  );
  assert.doesNotThrow(() => assertUploadsReady([[uploaded(MIB)]]));
});

test('formats quota usage and rejection guidance', () => {
  assert.equal(formatUploadBytes(0), '0 B');
  assert.equal(formatUploadBytes(100 * MIB), '100 MiB');
  assert.equal(
    formatQuotaExceededMessage(90 * MIB, 15 * MIB, 100 * MIB),
    'These files would use 105.0 MiB. The combined limit is 100 MiB, with 10.0 MiB remaining.',
  );
});
