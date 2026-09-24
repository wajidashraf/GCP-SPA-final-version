import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const readRepositoryFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('keeps the upload Function limits aligned with the 100 MiB request quota', () => {
  const config = readRepositoryFile('api/src/config.ts');
  const example = readRepositoryFile('api/local.settings.json.example');
  const readme = readRepositoryFile('api/README.md');

  assert.match(config, /optional\('MAX_FILE_BYTES', '104857600'\)/);
  assert.match(example, /"MAX_FILE_BYTES": "104857600"/);
  assert.match(
    example,
    /"FUNCTIONS_REQUEST_BODY_SIZE_LIMIT": "125829120"/,
  );
  assert.match(readme, /100 MiB/);
  assert.match(readme, /FUNCTIONS_REQUEST_BODY_SIZE_LIMIT/);
});
