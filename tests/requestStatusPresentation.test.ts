import assert from 'node:assert/strict';
import test from 'node:test';
import { requestStatusChoices } from '../src/data/requestChoices.ts';
import {
  getRequestStatusDisplayLabel,
  requestStatusFilterOptions,
} from '../src/shared/requestStatusPresentation.ts';

test('expands abbreviated request statuses consistently for rows and filters', () => {
  const expected = [
    { value: '0', label: 'For Record (FR)' },
    { value: '1', label: 'New' },
    { value: '2', label: 'Ready for Engagement' },
    { value: '3', label: 'Booked (R)' },
    { value: '4', label: 'Draft Review' },
    { value: '5', label: 'Pending Review' },
    { value: '6', label: 'Complete Review' },
    { value: '7', label: 'Pending Acceptance' },
    { value: '8', label: 'Complete Acceptance' },
    { value: '9', label: 'Pending Acknowledgement' },
    { value: '10', label: 'Acknowledged (ACK)' },
    { value: '11', label: 'Pending Endorsement' },
    { value: '12', label: 'Endorsed (E)' },
    { value: '13', label: 'Submitted' },
    { value: '14', label: 'Under Verification' },
    { value: '15', label: 'Scheduled' },
    { value: '16', label: 'Re-Submit (RS)' },
    { value: '17', label: 'Non-compliant (NC3)' },
    { value: '18', label: 'Non-compliant (NC4)' },
    { value: '19', label: 'Waived (W)' },
  ];

  assert.deepEqual(requestStatusFilterOptions, expected);
  for (const { value, label } of expected) {
    assert.equal(getRequestStatusDisplayLabel(Number(value)), label);
  }
});

test('uses the missing-value marker for absent and unknown statuses', () => {
  for (const status of [null, undefined, -1, 20, 999, NaN, Infinity]) {
    assert.equal(getRequestStatusDisplayLabel(status), '\u2014');
  }
});

test('keeps canonical workflow labels and numeric values intact', () => {
  const originalChoices = structuredClone(requestStatusChoices);
  for (const choice of requestStatusChoices) {
    getRequestStatusDisplayLabel(choice.value);
  }

  assert.deepEqual(requestStatusChoices, originalChoices);
  const canonicalLabels = {
    0: 'FR',
    3: 'R',
    9: 'Pending Ack',
    10: 'ACK',
    11: 'Pending Endorse',
    12: 'E',
    16: 'RS',
    17: 'NC3',
    18: 'NC4',
    19: 'W',
  };
  for (const [value, label] of Object.entries(canonicalLabels)) {
    assert.equal(
      requestStatusChoices.find((choice) => choice.value === Number(value))?.label,
      label,
    );
  }
  assert.deepEqual(
    requestStatusFilterOptions.map(({ value }) => value),
    requestStatusChoices.map(({ value }) => String(value)),
  );
});
