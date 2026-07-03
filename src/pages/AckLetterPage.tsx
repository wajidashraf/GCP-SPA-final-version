// src/pages/AckLetterPage.tsx
// Acknowledgement letter editor (GCP channel) — reached at
// /requests/:id/ack-letter once the request is at status 8/9 (after HOC
// acceptance). Submit advances the request to status 10 (Acknowledged / ACK).
//
// This is a letter, NOT a decision form: there is no conclusion code. The body
// comes from a matter-specific ACK template (src/components/letters); values we
// already hold auto-fill, the rest are manual variables the reviewer types in.
// Manual entries persist in gcp_acklettertextcontent via a machine-readable
// marker so they can be re-edited.
//
// The GCPC counterpart is EndorsementLetterPage — a deliberately separate page
// so the endorsement letter can carry its own structure/design.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { ArrowLeft, FileText, Loader2, Pencil, Printer, Send } from 'lucide-react';
import { InlineMessage, LoadingState } from '../components/ui';
import { useRequestDetail } from '../shared/hooks/useRequestDetail';
import { submitAckLetter, pollRequestStatus } from '../shared/services/requestService';
import { getChoiceLabel } from '../data/types';
import { soaCodeChoices } from '../data/soaChoices';
import { matterChoices } from '../data/matterChoices';
import {
  LetterDocument,
  parseStoredLetter,
  selectLetterTemplate,
  serializeLetter,
} from '../components/letters';
import type { LetterContext } from '../components/letters';

const LETTER_TYPE = 'Acknowledgement';
const TARGET_STATUS = 10; // Acknowledged (ACK)

export default function AckLetterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, isLoading, error } = useRequestDetail(id);

  // ── Derived meta ──────────────────────────────────────────────────────────
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request?.matter),
    [request?.matter],
  );
  const matterLabel = matter?.label ?? 'Request';
  const matterCode = matter?.code ?? null;
  const soaLabel =
    request?.soaCode != null
      ? (getChoiceLabel(soaCodeChoices, request.soaCode) ?? null)
      : null;

  const template = useMemo(
    () => selectLetterTemplate('ACK', matterCode),
    [matterCode],
  );

  // Letter number format: companyCode/projectCode/soaLabel/title/ACK
  const letterNumber = [
    request?.companyCode,
    request?.projectCode,
    soaLabel,
    request?.title,
    'ACK',
  ]
    .filter(Boolean)
    .join('/');

  const ctx: LetterContext | null = useMemo(
    () => (request ? { request, matterLabel, soaLabel } : null),
    [request, matterLabel, soaLabel],
  );

  // ── Form state ────────────────────────────────────────────────────────────
  const existingText = request?.ackLetterText ?? '';

  const [values, setValues] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Populate manual values from any saved letter once the request loads.
  useEffect(() => {
    if (!request) return;
    const raw = request.ackLetterText;
    const stored = parseStoredLetter(raw);
    const restored =
      stored && stored.templateKey === template.key ? stored.values : {};
    setValues(restored);
    // Start in edit mode when nothing has been saved yet.
    setIsEditing(!raw);
  }, [request?.id, template.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const isSubmitted = !isEditing && !!existingText && request?.status !== 8;
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Manual variables still empty — surfaced as a soft warning before submit.
  const missingVars = useMemo(() => {
    if (!ctx) return [];
    return template.variables
      .filter((v) => {
        const auto = v.auto?.(ctx);
        if (auto && auto.trim()) return false; // auto-filled
        return !values[v.key]?.trim();
      })
      .map((v) => v.label);
  }, [template, ctx, values]);

  // Required manual variables (e.g. the freeform letter body) that are still
  // empty — submission is blocked until these are filled.
  const missingRequired = useMemo(() => {
    if (!ctx) return [];
    return template.variables
      .filter((v) => v.isRequired)
      .filter((v) => {
        const auto = v.auto?.(ctx);
        if (auto && auto.trim()) return false; // auto-filled
        return !values[v.key]?.trim();
      })
      .map((v) => v.label);
  }, [template, ctx, values]);

  const handleSaveDraft = () => setIsEditing(false);

  const handleSubmit = () => {
    setFormError(null);
    setSubmitError(null);
    if (missingRequired.length > 0) {
      setIsEditing(true);
      setFormError(`Please fill in the ${missingRequired.join(', ')} before submitting.`);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!id || !ctx) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const payload = serializeLetter(template, ctx, values, letterNumber);
      await submitAckLetter(id, payload);
      await pollRequestStatus(id, TARGET_STATUS);
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

        {request && ctx ? (
          <div className="vd-card lp-card">
            <header className="vd-card-head no-print">
              <span className="vd-card-icon" aria-hidden="true">
                <FileText size={20} />
              </span>
              <div>
                <h1 className="vd-card-title">{LETTER_TYPE} Letter</h1>
                <p className="vd-card-sub">
                  {matterLabel}
                  {soaLabel ? ` · ${soaLabel}` : ''}
                  {request.title ? ` · ${request.title}` : ''}
                </p>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  className="lp-print-btn"
                  onClick={() => window.print()}
                  aria-label="Print this letter"
                >
                  <Printer size={14} aria-hidden="true" />
                  Print
                </button>
              ) : null}
            </header>

            <div className="vd-card-body lp-body">
              {isEditing ? (
                <InlineMessage tone="info" className="no-print mb-2">
                  Highlighted fields are filled from the request. Fill in the
                  remaining boxes — you can edit any text before submitting.
                </InlineMessage>
              ) : null}

              <LetterDocument
                template={template}
                ctx={ctx}
                values={values}
                letterNumber={letterNumber}
                editing={isEditing}
                onChange={handleChange}
              />

              {/* ── Errors / status ─────────────────────────────────── */}
              {formError ? (
                <InlineMessage tone="error" className="mt-1 no-print">
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
                  Saving the letter and updating the request status…
                </InlineMessage>
              ) : null}

              {/* ── Actions ─────────────────────────────────────────── */}
              {!isSubmitted ? (
                <div className="vd-actions no-print">
                  <button
                    type="button"
                    className="vd-btn-secondary"
                    onClick={() => navigate(id ? `/requests/${id}` : '/requests')}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  {isEditing ? (
                    <button
                      type="button"
                      className="vd-btn-secondary"
                      onClick={handleSaveDraft}
                      disabled={submitting}
                    >
                      Preview
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="vd-btn-secondary"
                      onClick={() => setIsEditing(true)}
                      disabled={submitting}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    className="rd-verify-btn"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                    Submit {LETTER_TYPE}
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

        {/* ── Confirm modal ───────────────────────────────────────────────── */}
        <Modal
          show={showConfirm}
          onHide={() => setShowConfirm(false)}
          centered
          backdrop="static"
          aria-labelledby="lp-confirm-title"
        >
          <Modal.Header closeButton>
            <Modal.Title id="lp-confirm-title" className="vd-card-title">
              Submit {LETTER_TYPE}?
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {missingVars.length > 0 ? (
              <InlineMessage tone="warning" title="Some fields are still empty" className="mb-2">
                {missingVars.join(', ')}. They’ll appear as placeholders in the
                letter. You can go back and fill them in, or submit anyway.
              </InlineMessage>
            ) : null}
            This will finalise the {LETTER_TYPE.toLowerCase()} letter and advance
            the request to <strong>Acknowledged (ACK)</strong>. This action
            cannot be undone.
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
              <Send size={16} aria-hidden="true" />
              Confirm &amp; Submit
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    </section>
  );
}
