// src/pages/RequestReview.tsx
// Reviewer decision screen. Reached from:
//   - "Review Request" button (status R = 3): initial review
//   - "Edit Review" button in SuggestionsViewModal (status Draft Review = 4): editing
//   - "Review Resubmission" button (status/outcome RS): re-review after an edit
//
// Buttons:
//   Submit Review     — Code 1 sets status 5; Codes 2–W use mapped status/outcome

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { ArrowLeft, ClipboardCheck, Loader2, Send } from 'lucide-react';
import {
  RadioGroupField,
  ReviewCommentEditor,
  TextAreaField,
  parseReviewComments,
  serializeReviewComments,
} from '../forms';
import type { ReviewCommentBlock, RadioOption } from '../forms';
import { InlineMessage, LoadingState } from '../components/ui';
import { useRequestDetail } from '../shared/hooks/useRequestDetail';
import { useAuth } from '../context/AuthContext';
import {
  deriveReviewTargets,
  getRequestById,
  getReviewFields,
  isRequestResubmittedForReview,
  reviewRequest,
  pollRequestStatus,
} from '../shared/services/requestService';
import { notifyEvent } from '../shared/notificationApi';
import { getChoiceLabel } from '../data/types';
import {
  decisionCodeChoices,
  decisionCodeDescriptions,
  outcomeChoices,
  requestStatusChoices,
} from '../data/requestChoices';
import type { DecisionCodeValue } from '../data/requestChoices';
import { soaCodeChoices } from '../data/soaChoices';
import { matterChoices } from '../data/matterChoices';
import type { MatterChoice } from '../data/matterChoices';

// Matter types that capture an editable "Info and Criteria for Review" field:
// PCCA (6), PP (7), R-PCCA (10), R-PP (14).
const INFO_CRITERIA_MATTERS = new Set<number>([6, 7, 10, 14]);
// The waiver decision code (W = 5) only applies to ST/SP (matter 4).
const WAIVER_MATTER = 4;
type ReviewMode = 'initial' | 'draft' | 'resubmission' | 'invalid';

export default function RequestReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { request, isLoading, error } = useRequestDetail(id);
  const { user } = useAuth();

  // Matter type / SOA code: prefer the loaded record, fall back to query params.
  const matterType = (
    request?.matter ?? (Number(searchParams.get('type')) || null)
  ) as MatterChoice['value'] | null;
  const soaCode =
    request?.soaCode ?? (Number(searchParams.get('soacode')) || null);

  const matterLabel = useMemo(
    () => matterChoices.find((m) => m.value === matterType)?.label ?? 'Request',
    [matterType],
  );
  const soaLabel = useMemo(
    () => (soaCode != null ? getChoiceLabel(soaCodeChoices, soaCode) : null),
    [soaCode],
  );

  const showInfoCriteria =
    matterType != null && INFO_CRITERIA_MATTERS.has(matterType);

  const reviewMode = useMemo<ReviewMode | null>(() => {
    if (!request) return null;
    if (request.status === 3) return 'initial';
    if (request.status === 4) return 'draft';
    if (isRequestResubmittedForReview(request)) return 'resubmission';
    return 'invalid';
  }, [request]);
  const isResubmissionReview = reviewMode === 'resubmission';

  useEffect(() => {
    if (!request || reviewMode !== 'invalid') return;
    const timer = setTimeout(
      () => navigate(`/requests/${request.id}`, { replace: true }),
      2500,
    );
    return () => clearTimeout(timer);
  }, [navigate, request, reviewMode]);

  // Decision codes: Code 1–4 always; the waiver code (W) only for ST/SP.
  const decisionOptions = useMemo<RadioOption[]>(
    () =>
      decisionCodeChoices
        .filter((c) => c.value !== 5 || matterType === WAIVER_MATTER)
        .map((c) => ({
          label: c.label,
          value: String(c.value),
          description: decisionCodeDescriptions[c.value],
        })),
    [matterType],
  );

  // ── Form state ──────────────────────────────────────────────────────────
  const [decisionCode, setDecisionCode] = useState('');
  const [blocks, setBlocks] = useState<ReviewCommentBlock[]>([]);
  const [infoCriteria, setInfoCriteria] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Draft/initial review keeps the existing prefill behavior. A resubmission
  // starts a clean decision/comment set without displaying the previous review.
  useEffect(() => {
    if (!id || !request || !reviewMode || reviewMode === 'invalid') return;
    let cancelled = false;
    setDecisionCode('');
    setBlocks([]);
    setInfoCriteria('');
    getReviewFields(id).then((fields) => {
      if (cancelled) return;
      if (reviewMode !== 'resubmission') {
        if (fields.decisionCode != null) {
          setDecisionCode(String(fields.decisionCode));
        }
        setBlocks(parseReviewComments(fields.reviewerComments));
      }
      setInfoCriteria(fields.infoAndCriteria ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [id, request, reviewMode]);

  const buildReviewInput = () => ({
    decisionCode: decisionCode ? (Number(decisionCode) as DecisionCodeValue) : null,
    reviewerComments: serializeReviewComments(blocks),
    infoAndCriteria: showInfoCriteria ? infoCriteria.trim() : undefined,
    reviewedByContactId: user?.contactId,
  });

  const selectedDecisionCode = decisionCode
    ? (Number(decisionCode) as DecisionCodeValue)
    : null;

  // Code 1 continues to Pending Review. Codes 2–W use their mapped statuses.
  // All decisions persist the outcome selected by deriveReviewTargets.
  const submissionTargets = useMemo(() => {
    if (selectedDecisionCode == null) return null;
    return deriveReviewTargets(
      selectedDecisionCode,
      request?.category ?? null,
      matterType,
    );
  }, [matterType, request?.category, selectedDecisionCode]);

  const submissionStatusLabel = submissionTargets
    ? getChoiceLabel(requestStatusChoices, submissionTargets.status) ??
      `Status ${submissionTargets.status}`
    : null;
  const submissionOutcomeLabel = submissionTargets
    ? getChoiceLabel(outcomeChoices, submissionTargets.outcome) ??
      `Outcome ${submissionTargets.outcome}`
    : null;

  // ── Submit review (Code 1 → status 5; Codes 2–W → mapped targets) ─────
  const handleSubmitReview = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!decisionCode) {
      setFormError('Please select a decision code before submitting.');
      return;
    }
    if (!submissionTargets) {
      setFormError('The selected decision code has no configured status/outcome mapping.');
      return;
    }
    setSubmitError(null);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!id || selectedDecisionCode == null || !submissionTargets) {
      setSubmitError('Missing request details. Cannot submit the review.');
      setShowConfirm(false);
      return;
    }
    setSubmitting(true);
    setShowConfirm(false);
    try {
      if (isResubmissionReview) {
        const latest = await getRequestById(id);
        if (!latest || !isRequestResubmittedForReview(latest)) {
          setSubmitError(
            'This request is no longer waiting for a resubmission review. Reload the latest request before submitting.',
          );
          setSubmitting(false);
          return;
        }
        if (latest.lastUpdatedDate !== request?.lastUpdatedDate) {
          setSubmitError(
            'This request was updated while you were reviewing it. Reload the latest version before submitting.',
          );
          setSubmitting(false);
          return;
        }
      }

      const draft = buildReviewInput();
      await reviewRequest(id, {
        decisionCode: selectedDecisionCode,
        status: submissionTargets.status,
        outcome: submissionTargets.outcome,
        reviewerComments: draft.reviewerComments,
        infoAndCriteria: draft.infoAndCriteria,
        reviewedByContactId: draft.reviewedByContactId,
      });
      await pollRequestStatus(id, submissionTargets.status);
      void notifyEvent(id, 'request_reviewed', user?.email);
      navigate(`/requests/${id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Failed to submit: ${err.message}`
          : 'Failed to submit. Please try again.',
      );
      setSubmitting(false);
    }
  };

  const decisionField = (
    <RadioGroupField
      name="decisionCode"
      label="Decision Code"
      isRequired
      isReadOnly={submitting}
      options={decisionOptions}
      value={decisionCode}
      onChange={setDecisionCode}
      error={formError ?? undefined}
      helpText="Select one review decision code."
    />
  );

  const decisionResult = submissionTargets ? (
    <InlineMessage tone="info" title="Automatic review result">
      Outcome: {submissionOutcomeLabel} · Status: {submissionStatusLabel}
    </InlineMessage>
  ) : null;

  const commentsField = (
    <ReviewCommentEditor
      label="Reviewer Comments"
      isReadOnly={submitting}
      value={blocks}
      onChange={setBlocks}
      helpText="Compose comments as text, bulleted or numbered list blocks."
    />
  );

  const infoField = showInfoCriteria ? (
    <TextAreaField
      name="infoAndCriteria"
      label="Info and Criteria for Review"
      rows={4}
      placeholder="Enter here…"
      value={infoCriteria}
      onChange={(e) => setInfoCriteria(e.target.value)}
      isReadOnly={submitting}
    />
  ) : null;

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
          <InlineMessage tone="error" title="Couldn't load this request">
            {error}
          </InlineMessage>
        ) : null}

        {!isLoading && !error && !request ? (
          <InlineMessage tone="warning" title="Request not found">
            We couldn't find a request with this ID.{' '}
            <Link to="/requests">Return to the requests list.</Link>
          </InlineMessage>
        ) : null}

        {request && reviewMode === 'invalid' ? (
          <InlineMessage tone="info" title="This request is not ready for review">
            Review is available for an initial R request, a Draft Review, or an
            RS request whose changes were submitted after the last review.
            Redirecting you back to the request…{' '}
            <Link to={`/requests/${request.id}`}>Go now.</Link>
          </InlineMessage>
        ) : null}

        {request && reviewMode !== 'invalid' ? (
          <div className="vd-card">
            <header className="vd-card-head">
              <span className="vd-card-icon" aria-hidden="true">
                <ClipboardCheck size={20} />
              </span>
              <div>
                <h1 className="vd-card-title">
                  {isResubmissionReview
                    ? 'Review Resubmitted Request'
                    : 'Review Request'}
                </h1>
                <p className="vd-card-sub">
                  {matterLabel}
                  {soaLabel ? ` · ${soaLabel}` : ''}
                  {request.title ? ` · ${request.title}` : ''}
                </p>
              </div>
            </header>

            <form className="vd-card-body" onSubmit={handleSubmitReview} noValidate>
              {/* Special matter types lead with Info → Comments → Decision. */}
              {showInfoCriteria ? (
                <>
                  {infoField}
                  {commentsField}
                  {decisionField}
                  {decisionResult}
                </>
              ) : (
                <>
                  {decisionField}
                  {decisionResult}
                  {commentsField}
                </>
              )}

              {submitError ? (
                <InlineMessage tone="error" title="Couldn't submit">
                  {submitError}
                </InlineMessage>
              ) : null}

              {submitting ? (
                <InlineMessage tone="loading" title="Saving">
                  Saving your changes…
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
                  {submitting ? (
                    <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  {isResubmissionReview ? 'Submit Re-review' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* ── Confirm review submission ────────────────────────────────── */}
        <Modal
          show={showConfirm}
          onHide={() => setShowConfirm(false)}
          centered
          backdrop="static"
          aria-labelledby="review-confirm-title"
        >
          <Modal.Header closeButton>
            <Modal.Title id="review-confirm-title" className="vd-card-title">
              Confirm submission
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Are you sure you want to submit this{' '}
            {isResubmissionReview ? 're-review' : 'review'}? This saves your
            decision
            {submissionTargets ? (
              <>
                {' '}
                with outcome <strong>{submissionOutcomeLabel}</strong> and moves the
                request to <strong>{submissionStatusLabel}</strong>.
              </>
            ) : (
              '.'
            )}
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="vd-btn-secondary"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
            <button type="button" className="rd-verify-btn" onClick={() => void handleConfirm()}>
              <Send size={16} aria-hidden="true" />
              Confirm
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    </section>
  );
}
