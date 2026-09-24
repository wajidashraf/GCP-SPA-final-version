import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterRequestList,
  formatSubmissionDate,
  getSubmissionDateRangeError,
  getRequestsReturnPath,
  parseRequestListState,
  serializeRequestListState,
} from '../src/shared/requestListState.ts';

const matterMetaByValue = new Map([
  [1, { label: 'Prospective Bidder List', code: 'PBL' }],
  [2, { label: 'Contractual Issue', code: 'CI' }],
]);

const requests = [
  {
    id: 'request-1',
    projectName: 'Alpha Expansion',
    companyName: 'Omega Three',
    companyCode: 'O3',
    status: 1,
    matter: 1,
    submittedOn: '2026-08-23T16:30:00Z',
  },
  {
    id: 'request-2',
    projectName: 'Beta Upgrade',
    companyName: 'Delta Holdings',
    companyCode: 'DH',
    status: 2,
    matter: 2,
    submittedOn: '2026-08-24T16:30:00Z',
  },
];

test('parses request-list state and falls back to safe defaults', () => {
  assert.deepEqual(
    parseRequestListState(
      new URLSearchParams(
        'matterTitle=bidder&project=alpha&company=o3&status=1&type=2&submittedFrom=2026-08-20&submittedTo=2026-08-24&page=3',
      ),
    ),
    {
      matterTitle: 'bidder',
      project: 'alpha',
      company: 'o3',
      status: '1',
      matterType: '2',
      submittedFrom: '2026-08-20',
      submittedTo: '2026-08-24',
      page: 3,
    },
  );

  assert.equal(
    parseRequestListState(new URLSearchParams('page=-4')).page,
    1,
  );
  assert.deepEqual(
    parseRequestListState(
      new URLSearchParams('submittedFrom=2026-02-30&submittedTo=not-a-date'),
    ),
    {
      matterTitle: '',
      project: '',
      company: '',
      status: '',
      matterType: '',
      submittedFrom: '',
      submittedTo: '',
      page: 1,
    },
  );
});

test('serializes only active request-list state and preserves submitted feedback', () => {
  assert.equal(
    serializeRequestListState(
      {
        matterTitle: 'bidder',
        project: 'alpha',
        company: '',
        status: '1',
        matterType: '',
        submittedFrom: '2026-08-20',
        submittedTo: '2026-08-24',
        page: 3,
      },
      'REQ-100',
    ).toString(),
    'matterTitle=bidder&project=alpha&status=1&submittedFrom=2026-08-20&submittedTo=2026-08-24&page=3&submitted=REQ-100',
  );
});

test('searches matter label and code case-insensitively', () => {
  const baseFilters = {
    project: '',
    company: '',
    status: '',
    matterType: '',
    submittedFrom: '',
    submittedTo: '',
  };

  assert.deepEqual(
    filterRequestList(
      requests,
      { ...baseFilters, matterTitle: 'prospective bidder' },
      matterMetaByValue,
    ).map((request) => request.id),
    ['request-1'],
  );
  assert.deepEqual(
    filterRequestList(
      requests,
      { ...baseFilters, matterTitle: 'pBl' },
      matterMetaByValue,
    ).map((request) => request.id),
    ['request-1'],
  );
});

test('combines typed and dropdown filters with AND semantics', () => {
  assert.deepEqual(
    filterRequestList(
      requests,
      {
        matterTitle: 'pbl',
        project: 'alpha',
        company: 'o3',
        status: '1',
        matterType: '1',
        submittedFrom: '',
        submittedTo: '',
      },
      matterMetaByValue,
    ).map((request) => request.id),
    ['request-1'],
  );

  assert.deepEqual(
    filterRequestList(
      requests,
      {
        matterTitle: 'pbl',
        project: 'beta',
        company: 'o3',
        status: '1',
        matterType: '1',
        submittedFrom: '',
        submittedTo: '',
      },
      matterMetaByValue,
    ),
    [],
  );
});

test('filters submission dates with inclusive Malaysia calendar-day boundaries', () => {
  const filters = {
    matterTitle: '',
    project: '',
    company: '',
    status: '',
    matterType: '',
    submittedFrom: '2026-08-24',
    submittedTo: '2026-08-24',
  };

  assert.deepEqual(
    filterRequestList(requests, filters, matterMetaByValue).map(
      (request) => request.id,
    ),
    ['request-1'],
  );
});

test('supports either submission-date boundary independently', () => {
  const base = {
    matterTitle: '',
    project: '',
    company: '',
    status: '',
    matterType: '',
  };

  assert.deepEqual(
    filterRequestList(
      requests,
      { ...base, submittedFrom: '2026-08-25', submittedTo: '' },
      matterMetaByValue,
    ).map((request) => request.id),
    ['request-2'],
  );
  assert.deepEqual(
    filterRequestList(
      requests,
      { ...base, submittedFrom: '', submittedTo: '2026-08-24' },
      matterMetaByValue,
    ).map((request) => request.id),
    ['request-1'],
  );
});

test('reports reversed ranges and does not apply an invalid date constraint', () => {
  const filters = {
    matterTitle: '',
    project: '',
    company: '',
    status: '',
    matterType: '',
    submittedFrom: '2026-08-26',
    submittedTo: '2026-08-24',
  };

  assert.equal(
    getSubmissionDateRangeError(filters),
    'From date must be on or before To date.',
  );
  assert.deepEqual(
    filterRequestList(requests, filters, matterMetaByValue).map(
      (request) => request.id,
    ),
    ['request-1', 'request-2'],
  );
});

test('excludes missing and invalid submission dates when a range is active', () => {
  const items = [
    ...requests,
    { ...requests[0], id: 'request-null', submittedOn: null },
    { ...requests[0], id: 'request-invalid', submittedOn: 'not-a-date' },
  ];
  const filters = {
    matterTitle: '',
    project: '',
    company: '',
    status: '',
    matterType: '',
    submittedFrom: '2026-08-24',
    submittedTo: '',
  };

  assert.deepEqual(
    filterRequestList(items, filters, matterMetaByValue).map(
      (request) => request.id,
    ),
    ['request-1', 'request-2'],
  );
});

test('formats submission dates consistently and safely', () => {
  assert.equal(formatSubmissionDate('2026-08-24T00:00:00Z'), '24 Aug 2026');
  assert.equal(formatSubmissionDate(null), '—');
  assert.equal(formatSubmissionDate('not-a-date'), '—');
});

test('accepts only exact Requests-list return paths', () => {
  assert.equal(
    getRequestsReturnPath({
      requestsReturnTo: '/requests?matterTitle=pbl&page=2',
    }),
    '/requests?matterTitle=pbl&page=2',
  );
  assert.equal(getRequestsReturnPath({ requestsReturnTo: '/requests' }), '/requests');
  assert.equal(
    getRequestsReturnPath({ requestsReturnTo: '/requests/record-1' }),
    '/requests',
  );
  assert.equal(
    getRequestsReturnPath({ requestsReturnTo: 'https://example.com/requests' }),
    '/requests',
  );
  assert.equal(getRequestsReturnPath(null), '/requests');
});
