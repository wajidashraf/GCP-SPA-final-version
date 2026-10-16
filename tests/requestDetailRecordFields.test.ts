import assert from 'node:assert/strict';
import test from 'node:test';
import { combineDetailRecordFields } from '../src/shared/requestDetailRecordFields.ts';

test('retains distinct values from every child record while sharing parent details once', () => {
  const result = combineDetailRecordFields(
    [{ label: 'Acknowledged', value: true }],
    [[{ label: 'Client', value: 'First client' }, { label: 'Remarks', value: 'First saved description' }],
      [{ label: 'Client', value: 'Second client' }, { label: 'Remarks', value: 'Second saved description' }]],
    new Set(['Project Name']),
  );
  assert.deepEqual(result.map((field) => field.value), [true, 'First client', 'First saved description', 'Second client', 'Second saved description']);
  assert.equal(result[1].label, 'Record 1 · Client');
  assert.equal(result[3].label, 'Record 2 · Client');
});

test('retains existing single-record labels and suppresses only already displayed basics and same-record duplicates', () => {
  const result = combineDetailRecordFields([], [[{ label: 'Project Name', value: 'Already shown' },
    { label: 'Remarks', value: 'Saved' }, { label: 'Remarks', value: 'Duplicate layout definition' }]], new Set(['Project Name']));
  assert.deepEqual(result, [{ label: 'Remarks', value: 'Saved' }]);
});
