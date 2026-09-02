/** Return the business-facing request reference used in notification emails. */
export const resolveEmailRequestNumber = (reviewNumber: unknown): string =>
  reviewNumber == null ? '' : String(reviewNumber).trim();
