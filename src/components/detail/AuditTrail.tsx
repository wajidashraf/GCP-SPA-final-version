// src/components/detail/AuditTrail.tsx
// Lifecycle audit trail for a request — shows each workflow step with its
// recorded timestamp. Loads engagements and signatures independently.

import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import DetailSection from './DetailSection';
import { listEngagementsByRequest } from '../../shared/services/engagementService';
import { listSignaturesForRequest } from '../../shared/services/signatureService';
import type { GcpSignature } from '../../shared/services/signatureService';
import type { Engagement } from '../../types/engagement';
import type { GcpRequest } from '../../types/request';

type Props = {
  request: GcpRequest;
  verifyDate: string | null;
  channel: 'gcp' | 'gcpc' | null;
};

type AuditStep = {
  label: string;
  timestamp: string | null;
  note?: string;
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const buildSteps = (
  request: GcpRequest,
  verifyDate: string | null,
  engagements: Engagement[],
  lastSig: GcpSignature | null,
  channel: 'gcp' | 'gcpc' | null,
): AuditStep[] => {
  const steps: AuditStep[] = [
    {
      label: 'Request Submitted',
      timestamp: request.submittedOn ?? request.createdOn ?? null,
    },
    { label: 'Verified', timestamp: verifyDate },
  ];

  engagements.forEach((eng, i) => {
    if (i === 0) {
      steps.push({ label: 'Engagement Scheduled', timestamp: eng.createdOn });
    }
    steps.push({
      label:
        engagements.length > 1
          ? `Engagement Session (R0${i + 1})`
          : 'Engagement Session',
      timestamp: eng.date,
      note: eng.statusLabel ?? undefined,
    });
  });

  if (engagements.length === 0) {
    steps.push({ label: 'Engagement Scheduled', timestamp: null });
    steps.push({ label: 'Engagement Session', timestamp: null });
  }

  steps.push({ label: 'Review Decision', timestamp: request.reviewDate });
  steps.push({
    label: 'Signatures Collected',
    timestamp: lastSig?.createdOn ?? null,
  });
  steps.push({ label: 'HOC Acceptance', timestamp: request.acceptanceDate });
  steps.push({
    label: channel === 'gcp' ? 'Acknowledgement Letter' : 'Endorsement Letter',
    timestamp:
      channel === 'gcp'
        ? request.acknowledgementDate
        : request.endorsementDate,
  });

  return steps;
};

export default function AuditTrail({ request, verifyDate, channel }: Props) {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [lastSig, setLastSig] = useState<GcpSignature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listEngagementsByRequest(request.id).catch((): Engagement[] => []),
      listSignaturesForRequest(request.id).catch((): GcpSignature[] => []),
    ]).then(([engs, sigs]) => {
      if (cancelled) return;
      setEngagements(engs);
      setLastSig(sigs.length > 0 ? sigs[sigs.length - 1] : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [request.id]);

  const steps = buildSteps(request, verifyDate, engagements, lastSig, channel);

  return (
    <DetailSection title="Audit Trail" icon={Clock}>
      {loading ? (
        <p className="rd-empty">Loading audit history…</p>
      ) : (
        <ol className="audit-timeline">
          {steps.map((step, i) => (
            <li
              key={i}
              className={`audit-step ${step.timestamp ? 'audit-step-done' : 'audit-step-pending'}`}
            >
              <span className="audit-step-icon" aria-hidden="true">
                {step.timestamp ? (
                  <CheckCircle size={14} />
                ) : (
                  <Circle size={14} />
                )}
              </span>
              <span className="audit-step-label">{step.label}</span>
              <span className="audit-step-time">
                {step.timestamp ? fmtDate(step.timestamp) : '—'}
                {step.note ? (
                  <em className="audit-step-note"> · {step.note}</em>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </DetailSection>
  );
}
