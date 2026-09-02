import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStoredLetter,
  serializeStoredLetter,
} from '../src/components/letters/letterPersistence.ts';
import { CC_LIST } from '../src/components/letters/letterTemplates.ts';

test('uses Siti Yuhaniz bt Bustari as the GCPC Chairman', () => {
  assert.equal(
    CC_LIST.includes('GCPC Chairman- Siti Yuhaniz bt Bustari'),
    true,
  );
  assert.equal(
    CC_LIST.includes('GCPC Chairman- Dato Rosli b Husin'),
    false,
  );
});

test('serializes letter metadata without HTML comment syntax and round-trips V2', () => {
  const serialized = serializeStoredLetter('Endorsement body', {
    templateKey: 'e-test',
    values: { manual: 'Approved wording' },
  });

  assert.equal(serialized.includes('<!--GCP_LETTER:'), false);
  assert.match(serialized, /\n\nGCP_LETTER_METADATA_V2:/);
  assert.deepEqual(parseStoredLetter(serialized), {
    templateKey: 'e-test',
    values: { manual: 'Approved wording' },
  });
});

test('continues to parse legacy HTML-comment letter metadata', () => {
  const legacy =
    'Legacy body\n\n<!--GCP_LETTER:{"templateKey":"e-test","values":{"manual":"Legacy wording"}}-->';

  assert.deepEqual(parseStoredLetter(legacy), {
    templateKey: 'e-test',
    values: { manual: 'Legacy wording' },
  });
});
