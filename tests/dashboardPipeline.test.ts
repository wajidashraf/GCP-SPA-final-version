import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPipelineStatusBars,
  orderPipelineStatusChoices,
  pipelineStatusOrder,
} from '../src/data/dashboardPipeline.ts';
import { requestStatusChoices } from '../src/data/requestChoices.ts';

test('orders the real Dataverse statuses by the request workflow', () => {
  const ordered = orderPipelineStatusChoices(requestStatusChoices);

  assert.deepEqual(
    ordered.map((choice) => choice.value),
    [...pipelineStatusOrder],
  );
  assert.deepEqual(
    ordered.map((choice) => choice.label),
    [
      'New',
      'Under Verification',
      'Ready for Engagement',
      'Scheduled',
      'R',
      'Draft Review',
      'RS',
      'Pending Review',
      'Complete Review',
      'Pending Acceptance',
      'Complete Acceptance',
      'Pending Ack',
      'ACK',
      'Pending Endorse',
      'E',
      'Submitted',
      'FR',
      'NC3',
      'NC4',
      'W',
    ],
  );
});

test('keeps only non-zero request statuses in workflow order', () => {
  const choices = [
    { label: 'New', value: 1 },
    { label: 'Ready for Engagement', value: 2 },
    { label: 'R', value: 3 },
    { label: 'RS', value: 16 },
  ];
  const counts = [7, 3, null, 2];

  assert.deepEqual(buildPipelineStatusBars(choices, counts), [
    { status: 1, name: 'New', count: 7 },
    { status: 2, name: 'Ready for Engagement', count: 3 },
    { status: 16, name: 'RS', count: 2 },
  ]);
});
