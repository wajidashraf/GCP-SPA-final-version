// src/pages/EndorseReview.tsx
// HOC Endorsement screen (GCPC channel) — reached from the "Endorse" button
// on RequestDetail when the request is at status 6 (Complete Review).
//
// All form logic lives in the shared ReviewDecisionForm; this page only
// selects the "endorse" wording variant. The GCP acknowledgement counterpart
// is HocAcceptance (variant="acknowledge"). On submit the request advances to
// status 11 (Pending Endorse).

import ReviewDecisionForm from '../components/acceptance/ReviewDecisionForm';

export default function EndorseReview() {
  return <ReviewDecisionForm variant="endorse" />;
}
