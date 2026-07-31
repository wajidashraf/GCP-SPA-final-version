// src/components/acceptance/ReviewDecisionForm.tsx
// HOC Acceptance decision form — reached at /requests/:id/hoc-acceptance for
// BOTH the GCP and GCPC channels (status 6 → "Complete Review").
//
// The HOC selects a conclusion code (1a / 1b / 2 / 3), adds a digital
// signature, then submits. This is the ONLY screen carrying a conclusion code.
// On submit the request advances along its channel:
//   GCP channel  → 9  (Pending Ack)     → then the Acknowledgement letter
//   GCPC channel → 11 (Pending Endorse) → then the Endorsement letter
// Signing is restricted to users with the HOC role whose company matches
// the company on the request. A saved signature can be resumed while the
// request remains at Complete Review (6); the document becomes read-only only
// after the acceptance itself advances the request.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PenLine,
  Printer,
} from 'lucide-react';
import { InlineMessage, LoadingState } from '../ui';
import { SignatureImage } from '../signatures/SignatureImage';
import { SignatureModal } from '../signatures/SignatureModal';
import { useRequestDetail } from '../../shared/hooks/useRequestDetail';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, hasRole } from '../../utils/authorization';
import {
  acceptReview,
  getRequestById,
  pollRequestStatus,
} from '../../shared/services/requestService';
import { listSignaturesForRequest } from '../../shared/services/signatureService';
import type { GcpSignature } from '../../shared/services/signatureService';
import { getChoiceLabel } from '../../data/types';
import { soaCodeChoices } from '../../data/soaChoices';
import { matterChoices } from '../../data/matterChoices';
import { requestStatusChoices } from '../../data/requestChoices';

type ConclusionCode = '1a' | '1b' | '2' | '3';

const CODE_OPTIONS: { value: ConclusionCode; label: string; description: string }[] = [
  {
    value: '1a',
    label: 'Code 1 (a)',
    description:
      'We agree to incorporate all of your comments in our submission and/or future action or during implementation.',
  },
  {
    value: '1b',
    label: 'Code 1 (b)',
    description:
      'We agree to incorporate all of your comments in our submission and/or future action or during implementation, EXCEPT the following which we will undertake to mitigate all related risks:',
  },
  {
    value: '2',
    label: 'Code 2',
    description:
      'We acknowledge the need to resubmit the document and incorporate your comments.',
  },
  {
    value: '3',
    label: 'Code 3',
    description: 'Acknowledged. We admit the non-compliance.',
  },
];

// Single set of HOC-acceptance wording — used for both channels. (GCPC requests
// still advance to a different status and a different follow-up letter, but the
// decision step itself is identical: a conclusion code + the HOC signature.)
const copy = {
  cardTitle: 'Review Acceptance',
  noun: 'acceptance',
  submitLabel: 'Submit Acceptance',
  submittingMsg: 'Saving your acceptance and updating the request status…',
  confirmTitle: 'Confirm acceptance',
  confirmBody:
    'Are you sure you want to submit this Review Acceptance? This will record your conclusion code and advance the request to the next stage.',
  printAria: 'Print this acceptance form',
} as const;

export default function ReviewDecisionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, isLoading, error, refetch } = useRequestDetail(id);
  const { user } = useAuth();

  // ── Derived meta ──────────────────────────────────────────────────────────
  const matterChoice = matterChoices.find((m) => m.value === request?.matter);
  const matterLabel = matterChoice?.label ?? 'Request';
  const channel = matterChoice?.channel ?? null;
  const soaLabel =
    request?.soaCode != null
      ? getChoiceLabel(soaCodeChoices, request.soaCode)
      : null;

  // Status the request should advance to upon submission:
  //   GCP channel  → 9  (Pending Ack)
  //   GCPC channel → 11 (Pending Endorse)
  const targetStatus: number | null =
    channel === 'gcp' ? 9 : channel === 'gcpc' ? 11 : null;

  // ── Conclusion-code options gated by the reviewer's decision code ─────────
  // The reviewer's decision code (gcp_decisioncode, set on the Review screen)
  // decides which HOC conclusion codes are offered here:
  //   • Review Code 1 (proceed with acceptance) → HOC chooses 1a / 1b.
  //   • Any other review code (2 / 3 / …)        → HOC chooses among 2 / 3.
  const reviewDecisionCode = request?.decisionCode ?? null;
  const visibleCodeOptions =
    reviewDecisionCode === 1
      ? CODE_OPTIONS.filter((o) => o.value === '1a' || o.value === '1b')
      : CODE_OPTIONS.filter((o) => o.value === '2' || o.value === '3');

  // ── HOC authorization ─────────────────────────────────────────────────────
  // The signing user must hold the HOC role AND belong to the same company as
  // the request. Admins bypass the company check.
  const isHocRole = hasRole('HOC');
  const isHocCompanyMatch =
    !!user?.companyAccountId &&
    !!request?.companyId &&
    user.companyAccountId.toLowerCase() === request.companyId.toLowerCase();
  const isEditable = request?.status === 6;
  const isCompleted =
    request?.status != null &&
    [8, 9, 10, 11, 12].includes(Number(request.status));
  const hasUnexpectedStatus = !!request && !isEditable && !isCompleted;
  const statusLabel =
    request?.status != null
      ? getChoiceLabel(requestStatusChoices, request.status)
      : null;
  const canSign =
    isEditable && (isAdmin() || (isHocRole && isHocCompanyMatch));

  // ── HOC signature ─────────────────────────────────────────────────────────
  const [hocSig, setHocSig] = useState<GcpSignature | null>(null);
  const [loadingSig, setLoadingSig] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  const loadHocSig = useCallback(async () => {
    if (!id) return;
    setLoadingSig(true);
    try {
      const all = await listSignaturesForRequest(id);
      setHocSig(all.find((s) => s.signatoryEmail === 'HOC') ?? null);
    } catch {
      setHocSig(null);
    } finally {
      setLoadingSig(false);
    }
  }, [id]);

  useEffect(() => { void loadHocSig(); }, [loadHocSig]);

  // A signature is saved before the final acceptance PATCH. Keep status 6
  // editable so a user can resume and submit after a refresh or interrupted
  // session. Only the completed/invalid workflow state locks the document.
  const isLocked = !isEditable;

  // ── Form state ────────────────────────────────────────────────────────────
  // Pre-populate from the loaded request if the form was previously submitted.
  const deriveCode = (): ConclusionCode | '' => {
    if (!request) return '';
    if (request.reviewCode1a) return '1a';
    if (request.reviewCode1b) return '1b';
    if (request.reviewCode2) return '2';
    if (request.reviewCode3) return '3';
    return '';
  };

  const [selectedCode, setSelectedCode] = useState<ConclusionCode | ''>('');
  const [exceptions, setExceptions] = useState(['', '', '']);

  // Populate once the request loads (or re-loads).
  useEffect(() => {
    if (!request) return;
    const code = deriveCode();
    if (code) setSelectedCode(code);
    if (request.reviewCode1bComment) {
      const parts = request.reviewCode1bComment.split(',').map((s) => s.trim());
      setExceptions([parts[0] ?? '', parts[1] ?? '', parts[2] ?? '']);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    setFormError(null);
    if (!canSign) {
      setFormError(`You are not authorized to sign this ${copy.noun}.`);
      return;
    }
    if (!isEditable) {
      setFormError('This request is not currently awaiting HOC acceptance.');
      return;
    }
    if (targetStatus == null) {
      setFormError('The request channel could not be determined. Contact your administrator.');
      return;
    }
    if (!selectedCode) {
      setFormError('Please select a conclusion code before submitting.');
      return;
    }
    if (
      selectedCode === '1b' &&
      !exceptions.some((exception) => exception.trim().length > 0)
    ) {
      setFormError('Add at least one exception or mitigation for Code 1 (b).');
      return;
    }
    if (!hocSig) {
      setFormError('Please add your digital signature before submitting.');
      return;
    }
    setSubmitError(null);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!id || targetStatus == null) return;
    setSubmitting(true);
    setShowConfirm(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const latestRequest = await getRequestById(id);
      if (!latestRequest || latestRequest.status !== 6) {
        throw new Error(
          'The request has already moved to another stage. Refresh the page before continuing.',
        );
      }
      const code1bComment =
        selectedCode === '1b'
          ? exceptions.map((value) => value.trim()).filter(Boolean).join(', ')
          : undefined;
      await acceptReview(id, { code: selectedCode as ConclusionCode, code1bComment, targetStatus });
      const confirmed = await pollRequestStatus(id, targetStatus);
      if (!confirmed) {
        throw new Error(
          'The acceptance was saved, but the new status could not be confirmed. Refresh the request before retrying.',
        );
      }
      await refetch();
      setSubmitSuccess(
        channel === 'gcp'
          ? 'Review Acceptance submitted. The request is now pending acknowledgement.'
          : 'Review Acceptance submitted. The request is now pending endorsement.',
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Failed to submit: ${err.message}`
          : 'Failed to submit. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sigDateStr = hocSig?.createdOn
    ? new Date(hocSig.createdOn).toLocaleString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kuala_Lumpur',
      })
    : null;
  const acceptanceDateStr = request?.acceptanceDate
    ? new Date(request.acceptanceDate).toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kuala_Lumpur',
      })
    : null;
  const signerName =
    hocSig?.signatoryName ??
    (hocSig ? 'Head of Company' : user?.name || 'Head of Company');
  const selectedOption = CODE_OPTIONS.find((option) => option.value === selectedCode);
  const nextStage =
    channel === 'gcp' ? 'Pending Acknowledgement' : 'Pending Endorsement';

  return (
    <section className="rd-page">
      <div className="container">
        <div className="rd-back no-print">
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

        {request ? (
          <div className="vd-card lp-card hoc-acceptance-card">
            <header className="vd-card-head no-print">
              <span className="vd-card-icon" aria-hidden="true">
                <ClipboardCheck size={20} />
              </span>
              <div>
                <h1 className="vd-card-title">{copy.cardTitle}</h1>
                <p className="vd-card-sub">
                  {matterLabel}
                  {soaLabel ? ` · ${soaLabel}` : ''}
                  {request.title ? ` · ${request.title}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="lp-print-btn no-print"
                onClick={() => window.print()}
                aria-label={copy.printAria}
              >
                <Printer size={14} aria-hidden="true" />
                Print
              </button>
            </header>

            <div className="vd-card-body">
              {/* ── Formal acceptance document (A4 paper sheet) ──────────── */}
              <article className="lp-doc hoc-doc">
              <header className="lp-doc-header">
                <p className="hoc-doc-kicker">GCP NEXUS · CONTROLLED DOCUMENT</p>
                <h2 className="lp-doc-title">{copy.cardTitle}</h2>
                <p className="lp-doc-sub">
                  ({matterLabel}
                  {soaLabel ? ` — ${soaLabel}` : ''})
                </p>
              </header>

              {/* Request info table (black header bar like the letters) */}
              <table className="lp-info-table">
                <thead>
                  <tr>
                    <th className="lp-info-bar" colSpan={2}>
                      REVIEW ACCEPTANCE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Company Name</th>
                    <td>{request.companyName ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Matters to Review</th>
                    <td>
                      {matterLabel}
                      {soaLabel ? ` · ${soaLabel}` : ''}
                    </td>
                  </tr>
                  <tr>
                    <th>Review Log No.</th>
                    <td>{request.title ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Review Date</th>
                    <td>
                      {request.reviewDate
                        ? new Date(request.reviewDate).toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <th>Document Status</th>
                    <td>
                      <span className={`hoc-doc-status ${isCompleted ? 'is-complete' : 'is-pending'}`}>
                        {isCompleted
                          ? 'Accepted'
                          : isEditable
                            ? 'Pending HOC Acceptance'
                            : statusLabel ?? 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                  {acceptanceDateStr ? (
                    <tr>
                      <th>Acceptance Date</th>
                      <td>{acceptanceDateStr}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="hoc-section-heading">
                <span>1</span>
                <div>
                  <strong>Conclusion and undertaking</strong>
                  <small>Select the statement that accurately records the company’s acceptance.</small>
                </div>
              </div>
              <p className="hoc-instruction">
                Select one conclusion based on the Summary Review Conclusion Code.
              </p>

              {/* ── Conclusion code radios ───────────────────────────────── */}
              <fieldset className="hoc-codes" disabled={isLocked || submitting}>
                <legend className="visually-hidden">Conclusion Code</legend>
                {visibleCodeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`hoc-code-option${selectedCode === opt.value ? ' hoc-code-option--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="conclusionCode"
                      value={opt.value}
                      checked={selectedCode === opt.value}
                      onChange={() => setSelectedCode(opt.value)}
                      className="hoc-code-radio"
                    />
                    <span className="hoc-code-badge">{opt.label}</span>
                    <span className="hoc-code-desc">{opt.description}</span>
                  </label>
                ))}
              </fieldset>

              {/* ── Code 1b exception inputs ─────────────────────────────── */}
              {selectedCode === '1b' && !isLocked ? (
                <div className="hoc-exceptions">
                  <p className="hoc-exceptions-label">
                    Exceptions / Mitigations
                  </p>
                  {exceptions.map((val, i) => (
                    <div key={i} className="hoc-exception-row">
                      <span className="hoc-exception-num">{i + 1}.</span>
                      <input
                        type="text"
                        className="hoc-exception-input"
                        placeholder="Type exception / mitigation…"
                        value={val}
                        disabled={submitting}
                        onChange={(e) =>
                          setExceptions((prev) =>
                            prev.map((v, j) => (j === i ? e.target.value : v)),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {/* ── Code 1b exceptions read-only display ─────────────────── */}
              {selectedCode === '1b' && isLocked && request.reviewCode1bComment ? (
                <div className="hoc-exceptions hoc-exceptions--locked">
                  <p className="hoc-exceptions-label">Exceptions / Mitigations</p>
                  <ol className="hoc-exceptions-list">
                    {request.reviewCode1bComment.split(',').map((s, i) =>
                      s.trim() ? <li key={i}>{s.trim()}</li> : null,
                    )}
                  </ol>
                </div>
              ) : null}

              <div className="hoc-divider" />

              {/* ── HOC Signature box ────────────────────────────────────── */}
              <div className="hoc-section-heading">
                <span>2</span>
                <div>
                  <strong>Authorization and signature</strong>
                  <small>The Head of Company must sign before this acceptance can be submitted.</small>
                </div>
              </div>
              <div className={`hoc-sig-box${hocSig ? ' hoc-sig-box--signed' : ''}`}>
                <div className="hoc-sig-img-wrapper">
                  {loadingSig ? (
                    <Loader2 size={20} className="sig-spin" aria-hidden="true" />
                  ) : hocSig?.signUrl ? (
                    <SignatureImage
                      src={hocSig.signUrl}
                      alt={`Signature of ${signerName}`}
                      className="hoc-sig-img"
                    />
                  ) : (
                    <span className="hoc-sig-awaiting">Awaiting signature</span>
                  )}
                </div>
                <div className="hoc-sig-info">
                  <strong className="hoc-sig-name">
                    {hocSig ? (
                      <CheckCircle2 size={14} aria-hidden="true" className="sig-check-icon" />
                    ) : null}
                    {signerName}
                  </strong>
                  <span className="hoc-sig-role">Head of Company</span>
                  <span className="hoc-sig-date">
                    {sigDateStr ? `Digitally signed: ${sigDateStr} MYT` : 'Not yet signed'}
                  </span>
                  {!hocSig && !submitting ? (
                    <button
                      type="button"
                      className="sig-sign-btn no-print"
                      onClick={() => setShowSignModal(true)}
                      disabled={!canSign}
                      aria-label="Add HOC signature"
                    >
                      <PenLine size={13} aria-hidden="true" />
                      Add Signature
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="hoc-signature-declaration">
                By submitting this document, the signatory confirms that the selected conclusion
                and any stated exceptions accurately represent the company’s acceptance of the
                Summary Review.
              </p>
              </article>

              {hasUnexpectedStatus ? (
                <InlineMessage tone="warning" title="Acceptance is not available" className="no-print">
                  This request is currently at{' '}
                  <strong>{statusLabel ?? `status ${request.status}`}</strong>.
                  HOC acceptance can only be completed when the request is at Complete Review.
                </InlineMessage>
              ) : null}

              {/* ── Authorization warning ───────────────────────────────── */}
              {isHocRole && !isHocCompanyMatch && isEditable ? (
                <InlineMessage tone="warning" title="Signing restricted" className="no-print">
                  Your company does not match the company on this request. Only
                  the HOC of the requesting company may sign this {copy.noun}.
                </InlineMessage>
              ) : null}

              {/* ── Errors ──────────────────────────────────────────────── */}
              {formError ? (
                <InlineMessage tone="error" className="mt-3 no-print">
                  {formError}
                </InlineMessage>
              ) : null}
              {submitError ? (
                <InlineMessage tone="error" title="Couldn't submit" className="no-print">
                  {submitError}
                </InlineMessage>
              ) : null}
              {submitSuccess ? (
                <InlineMessage tone="success" title="Acceptance completed" className="no-print">
                  {submitSuccess}
                </InlineMessage>
              ) : null}
              {hocSig && isEditable && !submitSuccess ? (
                <InlineMessage tone="info" title="Signature saved" className="no-print">
                  Review the selected conclusion, then submit the signed acceptance to complete this stage.
                </InlineMessage>
              ) : null}
              {submitting ? (
                <InlineMessage tone="loading" title="Submitting" className="no-print">
                  {copy.submittingMsg}
                </InlineMessage>
              ) : null}

              {/* ── Actions ─────────────────────────────────────────────── */}
              {isEditable ? (
                <div className="vd-actions no-print">
                  <button
                    type="button"
                    className="vd-btn-secondary"
                    onClick={() => navigate(id ? `/requests/${id}` : '/requests')}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rd-verify-btn"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedCode || !hocSig || !canSign}
                  >
                    {submitting ? (
                      <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                    ) : (
                      <ClipboardCheck size={16} aria-hidden="true" />
                    )}
                    {hocSig ? 'Submit Signed Acceptance' : copy.submitLabel}
                  </button>
                </div>
              ) : (
                <div className="vd-actions no-print">
                  <button
                    type="button"
                    className="vd-btn-secondary"
                    onClick={() => navigate(id ? `/requests/${id}` : '/requests')}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back to Request
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Confirm modal ─────────────────────────────────────────────── */}
        <Modal
          show={showConfirm}
          onHide={() => setShowConfirm(false)}
          centered
          backdrop="static"
          aria-labelledby="hoc-confirm-title"
        >
          <Modal.Header closeButton>
            <Modal.Title id="hoc-confirm-title" className="vd-card-title">
              {copy.confirmTitle}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{copy.confirmBody}</p>
            <dl className="hoc-confirm-summary">
              <div>
                <dt>Request</dt>
                <dd>{request?.title ?? '—'}</dd>
              </div>
              <div>
                <dt>Conclusion</dt>
                <dd>{selectedOption?.label ?? '—'}</dd>
              </div>
              <div>
                <dt>Signed by</dt>
                <dd>{signerName}</dd>
              </div>
              <div>
                <dt>Next stage</dt>
                <dd>{nextStage}</dd>
              </div>
            </dl>
            <InlineMessage tone="warning">
              Submission is final and cannot be undone from this page.
            </InlineMessage>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="vd-btn-secondary"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-verify-btn"
              onClick={() => void handleConfirm()}
            >
              <ClipboardCheck size={16} aria-hidden="true" />
              Confirm
            </button>
          </Modal.Footer>
        </Modal>

        {/* ── Signature modal ───────────────────────────────────────────── */}
        {showSignModal && isEditable && canSign ? (
          <SignatureModal
            show={showSignModal}
            memberName="Head of Company"
            memberEmail="HOC"
            requestId={id ?? ''}
            contactId={user?.contactId ?? null}
            loginHint={user?.email ?? undefined}
            onHide={() => setShowSignModal(false)}
            onSaved={() => {
              setShowSignModal(false);
              void loadHocSig();
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
