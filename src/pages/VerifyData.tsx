// src/pages/VerifyData.tsx
// Verifier decision screen for a request. Reached from the "Verify Data" button
// on RequestDetail (only while the request status is "New"). The verifier picks
// a new status and leaves a comment; on submit we patch the request, stamp the
// verifier audit fields, wait for the status to commit, then return to detail.
//
// The set of selectable statuses depends on the request's matter type (passed in
// the `type` query param and mirrored on the loaded record) — see buildStatusOptions.

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { SelectField, TextAreaField } from '../forms';
import type { SelectOption } from '../forms';
import { InlineMessage, LoadingState } from '../components/ui';
import { useRequestDetail } from '../shared/hooks/useRequestDetail';
import { useAuth } from '../context/AuthContext';
import {
  getVerifierComment,
  pollRequestStatus,
  verifyRequest,
} from '../shared/services/requestService';
import { notifyEvent } from '../shared/notificationApi';
import { getChoiceLabel } from '../data/types';
import { requestStatusChoices } from '../data/requestChoices';
import { matterChoices } from '../data/matterChoices';

const label = (value: number): string =>
  getChoiceLabel(requestStatusChoices, value) ?? `Status ${value}`;

/**
 * Build the selectable status list for a request, mirroring the verifier rules:
 *  - base options: FR (0), RS (16), Ready for Engagement (2)
 *  - special projects (RTP) additionally allow W (19)
 *  - the request's current status is always selectable (added if missing)
 *  - matter types 1, 5, 10, 11, 13, 14 drop "Ready for Engagement"
 *  - matter types 10, 11, 13, 14 add "Pending Ack" (9)
 *  - matter type 12 (Contract Progress Report) allows only FR (0) + current
 *  CAA (5) and RTP (1) therefore show FR (0), RS (16) + the current New (1)
 *  status — the page is only reachable while the request is New.
 */
const buildStatusOptions = (
  matter: number | null,
  currentStatus: number | null,
  currentStatusLabel: string | null,
  isSpecialProject: boolean
): SelectOption[] => {
  let list: number[] = [0, 16, 2];
  if (isSpecialProject) list.push(19);

  const addCurrent = () => {
    if (currentStatus != null && !list.includes(currentStatus)) list.push(currentStatus);
  };
  addCurrent();

  const mt = Number(matter);
  if ([1, 5, 10, 11, 13, 14].includes(mt)) list = list.filter((v) => v !== 2);
  if ([10, 11, 13, 14].includes(mt)) list.push(9);
  if (mt === 12) {
    list = list.filter((v) => v === 0);
    addCurrent();
  }
  // CAA (matter type 5): only FR (0), RS (16), New (1) — plus current if different.
  if (mt === 5) {
    list = [0, 16, 1];
    addCurrent();
  }

  return list.map((value) => ({
    label:
      value === currentStatus && currentStatusLabel ? currentStatusLabel : label(value),
    value: String(value),
  }));
};

export default function VerifyData() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { request, child, isLoading, error } = useRequestDetail(id);
  const { user } = useAuth();

  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Matter type: prefer the loaded record, fall back to the `type` query param.
  const matterType = request?.matter ?? (Number(searchParams.get('type')) || null);

  const matterLabel = useMemo(
    () => matterChoices.find((m) => m.value === matterType)?.label ?? 'Request',
    [matterType]
  );

  const isSpecialProject =
    child?.type === 'rtp' ? Boolean(child.records[0]?.specialProject) : false;

  const statusOptions = useMemo(
    () =>
      buildStatusOptions(
        matterType,
        request?.status ?? null,
        request?.status != null ? label(request.status) : null,
        isSpecialProject
      ),
    [matterType, request?.status, isSpecialProject]
  );

  // Default the dropdown to the request's current status once it loads.
  useEffect(() => {
    if (request?.status != null) setStatus(String(request.status));
  }, [request?.status]);

  // Prefill any existing verifier comment (resilient — stays blank on failure).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getVerifierComment(id).then((c) => {
      if (!cancelled && c) setComment(c);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSubmitError(null);

    if (!id) {
      setSubmitError('Missing request ID. Cannot update request.');
      return;
    }
    if (!status) {
      setFormError('Please select a request status before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const targetStatus = Number(status);
      await verifyRequest(id, {
        status: targetStatus,
        comment,
        verifiedByContactId: user?.contactId,
      });
      // Wait for Dataverse to commit so the detail page reads the fresh status.
      await pollRequestStatus(id, targetStatus);
      // Fire-and-forget: notify reviewers/requester. Never blocks navigation.
      void notifyEvent(id, 'request_verified', user?.email);
      navigate(`/requests/${id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Failed to update request: ${err.message}`
          : 'Failed to update request. Please try again.'
      );
      setSubmitting(false);
    }
  };

  return (
    <section className="rd-page">
      <div className="container">
        <div className="rd-back">
          <button
            type="button"
            className="rd-back-link"
            onClick={() => navigate(id ? `/requests/${id}` : '/requests')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to request
          </button>
        </div>

        {isLoading && !request ? (
          <LoadingState message="Loading request…" size="lg" />
        ) : null}

        {error ? (
          <InlineMessage tone="error" title="Couldn’t load this request">
            {error}
          </InlineMessage>
        ) : null}

        {!isLoading && !error && !request ? (
          <InlineMessage tone="warning" title="Request not found">
            We couldn’t find a request with this ID.{' '}
            <Link to="/requests">Return to the requests list.</Link>
          </InlineMessage>
        ) : null}

        {request ? (
          <div className="vd-card">
            <header className="vd-card-head">
              <span className="vd-card-icon" aria-hidden="true">
                <ClipboardCheck size={20} />
              </span>
              <div>
                <h1 className="vd-card-title">Verify Data</h1>
                <p className="vd-card-sub">
                  {matterLabel}
                  {request.title ? ` · ${request.title}` : ''}
                </p>
              </div>
            </header>

            <form className="vd-card-body" onSubmit={handleSubmit} noValidate>
              <SelectField
                name="requestStatus"
                label="Request Status"
                isRequired
                placeholder="Select a status"
                options={statusOptions}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                error={formError ?? undefined}
                isReadOnly={submitting}
              />

              <TextAreaField
                name="comment"
                label="Comment"
                rows={4}
                placeholder="Enter your comment here…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                isReadOnly={submitting}
                helpText="Optional. Shared with reviewers as the verifier comment."
              />

              {submitError ? (
                <InlineMessage tone="error" title="Couldn’t submit">
                  {submitError}
                </InlineMessage>
              ) : null}

              {submitting ? (
                <InlineMessage tone="loading" title="Updating request">
                  Saving your decision and confirming the status update…
                </InlineMessage>
              ) : null}

              <div className="vd-actions">
                <button
                  type="button"
                  className="vd-btn-secondary"
                  onClick={() => navigate(id ? `/requests/${id}` : '/requests')}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="rd-verify-btn" disabled={submitting}>
                  <ShieldCheck size={16} aria-hidden="true" />
                  Submit Verification
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
