import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  renderEmailHtml as renderPreviewEmailHtml,
  type EmailBlock,
} from '../src/shared/emailTemplate/renderTemplate.ts';

const require = createRequire(import.meta.url);
const { resolveEmailRequestNumber } = require('../api/src/email/requestReference.ts') as {
  resolveEmailRequestNumber: (reviewNumber: unknown) => string;
};
const { renderEmailHtml: renderApiEmailHtml } = require('../api/src/email/renderTemplate.ts') as {
  renderEmailHtml: (blocks: EmailBlock[], data: Record<string, string>) => string;
};

test('uses only the trimmed business review number for email Reference', () => {
  assert.equal(resolveEmailRequestNumber('  RV-2026-0042  '), 'RV-2026-0042');
  assert.equal(resolveEmailRequestNumber(null), '');
  assert.equal(resolveEmailRequestNumber(undefined), '');
});

const fieldBlocks: EmailBlock[] = [
  {
    type: 'fields',
    rows: [
      { label: 'Reference', value: '{{requestNumber}}' },
      { label: 'Request', value: '{{requestName}}' },
    ],
  },
];

for (const [name, render] of [
  ['send-side', renderApiEmailHtml],
  ['admin preview', renderPreviewEmailHtml],
] as const) {
  test(`${name} email omits Reference when the business number is empty`, () => {
    const html = render(fieldBlocks, {
      requestNumber: '',
      requestName: 'Acceptance of Award',
    });

    assert.doesNotMatch(html, />Reference</);
    assert.match(html, /Acceptance of Award/);
  });

  test(`${name} email displays a non-empty business Reference`, () => {
    const html = render(fieldBlocks, {
      requestNumber: 'RV-2026-0042',
      requestName: 'Acceptance of Award',
    });

    assert.match(html, />Reference</);
    assert.match(html, /RV-2026-0042/);
  });
}
