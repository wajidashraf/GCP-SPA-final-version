// src/pages/HocAcceptance.tsx
// HOC Acceptance screen — reached at /requests/:id/hoc-acceptance for BOTH the
// GCP and GCPC channels when the request is at status 6 (Complete Review).
//
// All form logic lives in the shared ReviewDecisionForm (conclusion code + HOC
// signature). On submit the request advances along its channel: GCP → 9
// (Pending Ack) then the Acknowledgement letter; GCPC → 11 (Pending Endorse)
// then the Endorsement letter.

import ReviewDecisionForm from '../components/acceptance/ReviewDecisionForm';

export default function HocAcceptance() {
  return <ReviewDecisionForm />;
}
