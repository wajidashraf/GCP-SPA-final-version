// src/pages/HocAcceptance.tsx
// HOC Acknowledgement screen (GCP channel) — reached from the "Acknowledge"
// button on RequestDetail when the request is at status 6 (Complete Review).
//
// All form logic lives in the shared ReviewDecisionForm; this page only
// selects the "acknowledge" wording variant. The GCPC endorsement counterpart
// is EndorseReview (variant="endorse").

import ReviewDecisionForm from '../components/acceptance/ReviewDecisionForm';

export default function HocAcceptance() {
  return <ReviewDecisionForm variant="acknowledge" />;
}
