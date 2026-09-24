import type { ChildKind } from './requestIntegrity.ts';

type RequestChildSource = {
  entitySet: string;
  logicalName: string;
  idField: string;
  parentField:
    | '_gcp_request_value'
    | '_gcp_requestlookup_value'
    | '_gcp_pblrequest_value';
};

const REQUEST_CHILD_SOURCE_BY_KIND: Record<ChildKind, RequestChildSource> = {
  rtp: {
    entitySet: 'gcp_rtprequests',
    logicalName: 'gcp_rtprequest',
    idField: 'gcp_rtprequestid',
    parentField: '_gcp_request_value',
  },
  pbl: {
    entitySet: 'gcp_pblrequests',
    logicalName: 'gcp_pblrequest',
    idField: 'gcp_pblrequestid',
    parentField: '_gcp_request_value',
  },
  jvp: {
    entitySet: 'gcp_jvmrequests',
    logicalName: 'gcp_jvmrequest',
    idField: 'gcp_jvmrequestid',
    parentField: '_gcp_request_value',
  },
  stsp: {
    entitySet: 'gcp_stsprequests',
    logicalName: 'gcp_stsprequest',
    idField: 'gcp_stsprequestid',
    parentField: '_gcp_request_value',
  },
  caa: {
    entitySet: 'gcp_caarequests',
    logicalName: 'gcp_caarequest',
    idField: 'gcp_caarequestid',
    parentField: '_gcp_request_value',
  },
  pcca: {
    entitySet: 'gcp_pccarequests',
    logicalName: 'gcp_pccarequest',
    idField: 'gcp_pccarequestid',
    parentField: '_gcp_request_value',
  },
  pp: {
    entitySet: 'gcp_pprequests',
    logicalName: 'gcp_pprequest',
    idField: 'gcp_pprequestid',
    parentField: '_gcp_request_value',
  },
  vap: {
    entitySet: 'gcp_vaprequests',
    logicalName: 'gcp_vaprequest',
    idField: 'gcp_vaprequestid',
    parentField: '_gcp_request_value',
  },
  other: {
    entitySet: 'gcp_otherrequestses',
    logicalName: 'gcp_otherrequests',
    idField: 'gcp_otherrequestsid',
    parentField: '_gcp_requestlookup_value',
  },
  rpcca: {
    entitySet: 'gcp_rpccarequestgcps',
    logicalName: 'gcp_rpccarequestgcp',
    idField: 'gcp_rpccarequestgcpid',
    parentField: '_gcp_request_value',
  },
  rpp: {
    entitySet: 'gcp_rpprequests',
    logicalName: 'gcp_rpprequest',
    idField: 'gcp_rpprequestid',
    parentField: '_gcp_request_value',
  },
  ci: {
    entitySet: 'gcp_requestcigcps',
    logicalName: 'gcp_requestcigcp',
    idField: 'gcp_requestcigcpid',
    parentField: '_gcp_request_value',
  },
  cpr: {
    entitySet: 'gcp_cprrequestgcps',
    logicalName: 'gcp_cprrequestgcp',
    idField: 'gcp_cprrequestgcpid',
    parentField: '_gcp_request_value',
  },
};

const PBL_BIDDER_SOURCE: RequestChildSource = {
  entitySet: 'gcp_pblbidderses',
  logicalName: 'gcp_pblbidders',
  idField: 'gcp_pblbiddersid',
  parentField: '_gcp_pblrequest_value',
};

export { PBL_BIDDER_SOURCE, REQUEST_CHILD_SOURCE_BY_KIND };
export type { RequestChildSource };
