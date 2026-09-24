import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PBL_BIDDER_SOURCE,
  REQUEST_CHILD_SOURCE_BY_KIND,
} from '../src/shared/requestChildSources.ts';

const EXPECTED = {
  rtp: ['gcp_rtprequests', 'gcp_rtprequest', 'gcp_rtprequestid'],
  pbl: ['gcp_pblrequests', 'gcp_pblrequest', 'gcp_pblrequestid'],
  jvp: ['gcp_jvmrequests', 'gcp_jvmrequest', 'gcp_jvmrequestid'],
  stsp: ['gcp_stsprequests', 'gcp_stsprequest', 'gcp_stsprequestid'],
  caa: ['gcp_caarequests', 'gcp_caarequest', 'gcp_caarequestid'],
  pcca: ['gcp_pccarequests', 'gcp_pccarequest', 'gcp_pccarequestid'],
  pp: ['gcp_pprequests', 'gcp_pprequest', 'gcp_pprequestid'],
  vap: ['gcp_vaprequests', 'gcp_vaprequest', 'gcp_vaprequestid'],
  other: ['gcp_otherrequestses', 'gcp_otherrequests', 'gcp_otherrequestsid'],
  rpcca: [
    'gcp_rpccarequestgcps',
    'gcp_rpccarequestgcp',
    'gcp_rpccarequestgcpid',
  ],
  rpp: ['gcp_rpprequests', 'gcp_rpprequest', 'gcp_rpprequestid'],
  ci: ['gcp_requestcigcps', 'gcp_requestcigcp', 'gcp_requestcigcpid'],
  cpr: [
    'gcp_cprrequestgcps',
    'gcp_cprrequestgcp',
    'gcp_cprrequestgcpid',
  ],
} as const;

test('publishes the verified source metadata for every request child kind', () => {
  assert.equal(Object.keys(REQUEST_CHILD_SOURCE_BY_KIND).length, 13);

  for (const [kind, [entitySet, logicalName, idField]] of Object.entries(
    EXPECTED,
  )) {
    assert.deepEqual(
      REQUEST_CHILD_SOURCE_BY_KIND[
        kind as keyof typeof REQUEST_CHILD_SOURCE_BY_KIND
      ],
      {
        entitySet,
        logicalName,
        idField,
        parentField:
          kind === 'other'
            ? '_gcp_requestlookup_value'
            : '_gcp_request_value',
      },
    );
  }
});

test('publishes the verified PBL bidder source metadata', () => {
  assert.deepEqual(PBL_BIDDER_SOURCE, {
    entitySet: 'gcp_pblbidderses',
    logicalName: 'gcp_pblbidders',
    idField: 'gcp_pblbiddersid',
    parentField: '_gcp_pblrequest_value',
  });
});
