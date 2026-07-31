type ReviewerCommentPayload = {
  gcp_reviewercomments: string;
};

/** Build the isolated Dataverse fields used by an inline comment save. */
const buildReviewerCommentPayload = (
  reviewerComments: string,
): ReviewerCommentPayload => {
  if (!reviewerComments.trim()) {
    throw new Error('Reviewer comment is required.');
  }
  return { gcp_reviewercomments: reviewerComments };
};

export { buildReviewerCommentPayload };
export type { ReviewerCommentPayload };
