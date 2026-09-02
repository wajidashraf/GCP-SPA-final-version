type AcceptReviewCode = '1a' | '2' | '3';

type AcceptReviewInput = {
  code: AcceptReviewCode;
  targetStatus?: number;
};

const buildAcceptReviewPayload = (
  input: AcceptReviewInput,
  acceptanceDate: string,
): Record<string, unknown> => ({
  gcp_reviewconclusioncode1a: input.code === '1a',
  gcp_reviewconclusioncode1b: false,
  gcp_reviewconclusioncode2: input.code === '2',
  gcp_reviewconclusioncode3: input.code === '3',
  gcp_reviewconclusioncode1bcomment: '',
  gcp_acceptancedate: acceptanceDate,
  gcp_requeststatus: input.targetStatus ?? 8,
});

export { buildAcceptReviewPayload };
export type { AcceptReviewCode, AcceptReviewInput };
