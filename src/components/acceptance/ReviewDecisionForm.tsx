// src/components/acceptance/ReviewDecisionForm.tsx
// Shared HOC decision form behind two screens:
//   • Acknowledgement (GCP)  → reached at /requests/:id/hoc-acceptance
//   • Endorsement   (GCPC)   → reached at /requests/:id/endorse
//
// The HOC selects a conclusion code (1a / 1b / 2 / 3), adds a digital
// signature, then submits. On submit the request advances to:
//   GCP channel  → 9  (Pending Ack)
//   GCPC channel → 11 (Pending Endorse)
// Signing is restricted to users with the HOC role whose company matches
// the company on the request. The form is read-only once a HOC signature
// exists (the signature acts as the final lock).
//
// The only difference between the two screens is wording, driven by the
// `variant` prop — the fields, backend write, and status logic are identical.

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
import { SignatureModal } from '../signatures/SignatureModal';
import { useRequestDetail } from '../../shared/hooks/useRequestDetail';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, hasRole } from '../../utils/authorization';
import {
  acceptReview,
  pollRequestStatus,
} from '../../shared/services/requestService';
import { listSignaturesForRequest } from '../../shared/services/signatureService';
import type { GcpSignature } from '../../shared/services/signatureService';
import { getChoiceLabel } from '../../data/types';
import { soaCodeChoices } from '../../data/soaChoices';
import { matterChoices } from '../../data/matterChoices';

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

export type ReviewDecisionVariant = 'acknowledge' | 'endorse';

type Copy = {
  cardTitle: string;
  noun: string; // lowercase noun used in inline copy, e.g. "acceptance"
  sigName: string;
  submitLabel: string;
  submittingMsg: string;
  confirmTitle: string;
  confirmBody: string;
  printAria: string;
};

const COPY: Record<ReviewDecisionVariant, Copy> = {
  acknowledge: {
    cardTitle: 'Review Acceptance',
    noun: 'acceptance',
    sigName: 'Accepted by',
    submitLabel: 'Submit Acceptance',
    submittingMsg: 'Saving your acceptance and updating the request status…',
    confirmTitle: 'Confirm acceptance',
    confirmBody:
      'Are you sure you want to submit this Review Acceptance? This will record your conclusion code and advance the request to the next stage.',
    printAria: 'Print this acceptance form',
  },
  endorse: {
    cardTitle: 'Review Endorsement',
    noun: 'endorsement',
    sigName: 'Endorsed by',
    submitLabel: 'Submit Endorsement',
    submittingMsg: 'Saving your endorsement and updating the request status…',
    confirmTitle: 'Confirm endorsement',
    confirmBody:
      'Are you sure you want to submit this Review Endorsement? This will record your conclusion code and advance the request to the next stage.',
    printAria: 'Print this endorsement form',
  },
};

export default function ReviewDecisionForm({
  variant,
}: {
  variant: ReviewDecisionVariant;
}) {
  const copy = COPY[variant];
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, isLoading, error } = useRequestDetail(id);
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
  const targetStatus: number = channel === 'gcp' ? 9 : 11;

  // ── HOC authorization ─────────────────────────────────────────────────────
  // The signing user must hold the HOC role AND belong to the same company as
  // the request. Admins bypass the company check.
  const isHocRole = hasRole('HOC');
  const isHocCompanyMatch =
    !!user?.companyAccountId &&
    !!request?.companyId &&
    user.companyAccountId === request.companyId;
  const canSign = isAdmin() || (isHocRole && isHocCompanyMatch);

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

  // Form is read-only once a HOC signature exists.
  const isLocked = !!hocSig;

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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    setFormError(null);
    if (!canSign) {
      setFormError(`You are not authorized to sign this ${copy.noun}.`);
      return;
    }
    if (!selectedCode) {
      setFormError('Please select a conclusion code before submitting.');
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
    if (!id) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const code1bComment =
        selectedCode === '1b'
          ? exceptions.filter(Boolean).join(', ')
          : undefined;
      await acceptReview(id, { code: selectedCode as ConclusionCode, code1bComment, targetStatus });
      await pollRequestStatus(id, targetStatus);
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

  const sigDateStr = hocSig?.createdOn
    ? new Date(hocSig.createdOn).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

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
          <div className="vd-card">
            <header className="vd-card-head">
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
              {/* ── Request meta strip ──────────────────────────────────── */}
              <dl className="hoc-meta-strip">
                <div className="hoc-meta-item">
                  <dt>Review Log No.</dt>
                  <dd>{request.title ?? '—'}</dd>
                </div>
                <div className="hoc-meta-item">
                  <dt>Review Date</dt>
                  <dd>
                    {request.reviewDate
                      ? new Date(request.reviewDate).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </dd>
                </div>
              </dl>

              <p className="hoc-instruction">
                Please tick ( ✓ ) based on the Summary Review Conclusion Code.
              </p>

              {/* ── Conclusion code radios ───────────────────────────────── */}
              <fieldset className="hoc-codes" disabled={isLocked || submitting}>
                <legend className="visually-hidden">Conclusion Code</legend>
                {CODE_OPTIONS.map((opt) => (
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
              <div className={`hoc-sig-box${hocSig ? ' hoc-sig-box--signed' : ''}`}>
                <div className="hoc-sig-img-wrapper">
                  {loadingSig ? (
                    <Loader2 size={20} className="sig-spin" aria-hidden="true" />
                  ) : hocSig?.signUrl ? (
                    <img
                      src={hocSig.signUrl}
                      alt="HOC Signature"
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
                    {copy.sigName}
                  </strong>
                  <span className="hoc-sig-role">Head of Company</span>
                  <span className="hoc-sig-date">
                    {sigDateStr ? `Signed: ${sigDateStr}` : 'Not yet signed'}
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

              {/* ── Authorization warning ───────────────────────────────── */}
              {isHocRole && !isHocCompanyMatch && !isLocked ? (
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
              {submitting ? (
                <InlineMessage tone="loading" title="Submitting" className="no-print">
                  {copy.submittingMsg}
                </InlineMessage>
              ) : null}

              {/* ── Actions ─────────────────────────────────────────────── */}
              {!isLocked ? (
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
                    {copy.submitLabel}
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
          <Modal.Body>{copy.confirmBody}</Modal.Body>
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
        {showSignModal ? (
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
