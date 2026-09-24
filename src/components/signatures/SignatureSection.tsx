import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, PenLine } from 'lucide-react';
import { InlineMessage, LoadingState } from '../ui';
import { SignatureModal } from './SignatureModal';
import { SignatureImage } from './SignatureImage';
import {
  completeReview,
  confirmReusableSignature,
  getSignatureBoxState,
  isUsableSignature,
  listLatestReusableSignature,
  listSignaturesForRequest,
} from '../../shared/services/signatureService';
import type { GcpSignature } from '../../shared/services/signatureService';
import {
  listSignatoryMembers,
  getSignatoryThresholds,
  isSignatoryApiConfigured,
} from '../../shared/signatoryApi';
import type { SignatoryMemberDto, SignatoryThresholds } from '../../shared/signatoryApi';
import { isAdmin, hasRole } from '../../utils/authorization';

type SignatureSectionProps = {
  requestId: string;
  currentUserEmail: string | null;
  currentUserContactId: string | null;
  currentUserLoginHint?: string;
  onReviewCompleted: () => void;
};

type SignatureBoxProps = {
  member: SignatoryMemberDto;
  signature: GcpSignature | undefined;
  reusableSignature: GcpSignature | null;
  canSign: boolean;
  confirming: boolean;
  onSign: () => void;
  onConfirm: () => void;
};

const SignatureBox = ({
  member,
  signature,
  reusableSignature,
  canSign,
  confirming,
  onSign,
  onConfirm,
}: SignatureBoxProps) => {
  const state = getSignatureBoxState(signature, reusableSignature);
  const hasSig = state === 'signed';
  const hasReusableSig = state === 'reusable';
  const displayedSignature = hasSig ? signature : reusableSignature;
  const dateStr = signature?.createdOn
    ? new Date(signature.createdOn).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className={`sig-box${hasSig ? ' sig-box--signed' : ''}${hasReusableSig ? ' sig-box--saved' : ''}`}
    >
      <div className="sig-img-wrapper">
        {displayedSignature?.signUrl ? (
          <SignatureImage
            src={displayedSignature.signUrl}
            alt={
              hasSig
                ? `Signature of ${member.name}`
                : `Saved signature preview for ${member.name}`
            }
            className="sig-img"
          />
        ) : (
          <span className="sig-awaiting">Awaiting signature</span>
        )}
      </div>
      <div className="sig-info">
        <strong className="sig-name">
          {hasSig ? (
            <CheckCircle2
              size={14}
              aria-hidden="true"
              className="sig-check-icon"
            />
          ) : null}
          {member.name}
        </strong>
        <span className="sig-role">Member of Working GCPC</span>
        <span className="sig-date">
          {dateStr
            ? `Signed: ${dateStr}`
            : hasReusableSig
              ? 'Saved signature — not yet confirmed for this request'
              : 'Not yet signed'}
        </span>
        {canSign && hasReusableSig ? (
          <div className="sig-reuse-actions">
            <button
              type="button"
              className="sig-sign-btn"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <>
                  <Loader2 size={13} aria-hidden="true" className="sig-spin" />
                  Confirming…
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  Confirm Signature
                </>
              )}
            </button>
            <button
              type="button"
              className="sig-replace-btn"
              onClick={onSign}
              disabled={confirming}
            >
              <PenLine size={12} aria-hidden="true" />
              Draw/Upload Different
            </button>
          </div>
        ) : canSign && !hasSig ? (
          <button
            type="button"
            className="sig-sign-btn"
            onClick={onSign}
            aria-label={`Sign as ${member.name}`}
          >
            <PenLine size={13} aria-hidden="true" />
            Sign
          </button>
        ) : null}
      </div>
    </div>
  );
};

const SignatureSection = ({
  requestId,
  currentUserEmail,
  currentUserContactId,
  currentUserLoginHint,
  onReviewCompleted,
}: SignatureSectionProps) => {
  const [members, setMembers] = useState<SignatoryMemberDto[]>([]);
  const [signatures, setSignatures] = useState<GcpSignature[]>([]);
  const [thresholds, setThresholds] = useState<SignatoryThresholds>({ preparedCount: 1, confirmCount: 2 });
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingSignatures, setLoadingSignatures] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [sigsError, setSigsError] = useState<string | null>(null);
  const [reusableSignature, setReusableSignature] = useState<GcpSignature | null>(null);
  const [loadingReusable, setLoadingReusable] = useState(true);
  const [reusableError, setReusableError] = useState<string | null>(null);
  const [signingMember, setSigningMember] = useState<SignatoryMemberDto | null>(null);
  const [confirmingMemberId, setConfirmingMemberId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const [list, t] = await Promise.all([
        listSignatoryMembers(currentUserLoginHint),
        getSignatoryThresholds(currentUserLoginHint),
      ]);
      setMembers(list);
      setThresholds(t);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : 'Failed to load signatory members.',
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUserLoginHint]);

  const loadSignatures = useCallback(async () => {
    setLoadingSignatures(true);
    setSigsError(null);
    try {
      const list = await listSignaturesForRequest(requestId);
      setSignatures(list);
    } catch (err) {
      setSigsError(
        err instanceof Error ? err.message : 'Failed to load signatures.',
      );
    } finally {
      setLoadingSignatures(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadMembers();
    void loadSignatures();
  }, [loadMembers, loadSignatures]);

  const prepared = members.filter((m) => m.group === 'prepared');
  const confirmed = members.filter((m) => m.group === 'confirmed');

  const signatureFor = (member: SignatoryMemberDto) =>
    signatures.find(
      (s) =>
        s.signatoryEmail?.toLowerCase() === member.email.toLowerCase() &&
        isUsableSignature(s),
    );

  const isSigned = (member: SignatoryMemberDto) =>
    signatureFor(member) != null;

  // A signatory member may only sign their own box: the logged-in user's
  // email must match the member's email. Role is intentionally NOT checked —
  // a signatory member need not hold the Working GCPC role to sign.
  // (Client-side gate only — see utils/authorization.ts.)
  const canMemberSign = (member: SignatoryMemberDto): boolean =>
    !!currentUserEmail &&
    currentUserEmail.toLowerCase() === member.email.toLowerCase();

  const currentUserMember = members.find(canMemberSign);
  const currentUserSignature = currentUserMember
    ? signatureFor(currentUserMember)
    : undefined;
  const currentUserMemberId = currentUserMember?.id ?? null;
  const currentUserMemberEmail = currentUserMember?.email ?? null;
  const hasCurrentUserSignature = currentUserSignature != null;

  useEffect(() => {
    let cancelled = false;

    if (loadingMembers || loadingSignatures) {
      return () => { cancelled = true; };
    }
    if (
      membersError ||
      sigsError ||
      !currentUserMemberId ||
      !currentUserMemberEmail ||
      hasCurrentUserSignature
    ) {
      setReusableSignature(null);
      setReusableError(null);
      setLoadingReusable(false);
      return () => { cancelled = true; };
    }

    setReusableSignature(null);
    setReusableError(null);
    setLoadingReusable(true);
    void listLatestReusableSignature({
      requestId,
      signatoryEmail: currentUserMemberEmail,
      signatoryContactId: currentUserContactId,
    })
      .then((savedSignature) => {
        if (!cancelled) setReusableSignature(savedSignature);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReusableError(
            err instanceof Error
              ? err.message
              : 'Failed to load your saved signature.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReusable(false);
      });

    return () => { cancelled = true; };
  }, [
    currentUserContactId,
    currentUserMemberEmail,
    currentUserMemberId,
    hasCurrentUserSignature,
    loadingMembers,
    loadingSignatures,
    membersError,
    requestId,
    sigsError,
  ]);

  const preparedSignedCount = prepared.filter(isSigned).length;
  const confirmedSignedCount = confirmed.filter(isSigned).length;
  const isComplete =
    preparedSignedCount >= thresholds.preparedCount &&
    confirmedSignedCount >= thresholds.confirmCount;
  const canCompleteReview = isComplete && (isAdmin() || hasRole('Reviewer'));

  const handleSign = (member: SignatoryMemberDto) => {
    setConfirmError(null);
    setSigningMember(member);
  };

  const handleConfirmReusable = async (member: SignatoryMemberDto) => {
    if (!reusableSignature?.signUrl || !canMemberSign(member)) return;
    setConfirmError(null);
    setConfirmingMemberId(member.id);
    try {
      await confirmReusableSignature({
        requestId,
        signatoryEmail: member.email,
        signatoryContactId: currentUserContactId,
        signUrl: reusableSignature.signUrl,
      });
      setReusableSignature(null);
      await loadSignatures();
    } catch (err) {
      setConfirmError(
        err instanceof Error
          ? err.message
          : 'Failed to confirm your saved signature.',
      );
    } finally {
      setConfirmingMemberId(null);
    }
  };

  const handleSigned = async () => {
    setSigningMember(null);
    await loadSignatures();
  };

  const handleCompleteReview = async () => {
    setCompleteError(null);
    setCompleting(true);
    try {
      await completeReview(requestId);
      onReviewCompleted();
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : 'Failed to complete review.',
      );
    } finally {
      setCompleting(false);
    }
  };

  const isLoading = loadingMembers || loadingSignatures || loadingReusable;

  if (!isSignatoryApiConfigured) {
    return (
      <div className="sig-section">
        <InlineMessage tone="warning" title="Signatures unavailable">
          The signature service is not configured. Contact your administrator.
        </InlineMessage>
      </div>
    );
  }

  return (
    <div className="sig-section">
      <div className="sig-section-header">
        <h2 className="sig-section-title">
          <PenLine size={18} aria-hidden="true" />
          Signatures
        </h2>
        {!isLoading ? (
          <span className="sig-section-status">
            {isComplete ? (
              <span className="sig-status-complete">
                <CheckCircle2 size={14} aria-hidden="true" />
                All thresholds met
              </span>
            ) : (
              <span className="sig-status-pending">
                {preparedSignedCount}/{thresholds.preparedCount} prepared · {confirmedSignedCount}/{thresholds.confirmCount} confirmed
              </span>
            )}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState message="Loading signatures…" size="sm" />
      ) : null}

      {membersError ? (
        <InlineMessage tone="error" className="mb-3">
          {membersError}
        </InlineMessage>
      ) : null}

      {sigsError ? (
        <InlineMessage tone="warning" className="mb-3">
          {sigsError} Signatures shown may be incomplete.
        </InlineMessage>
      ) : null}

      {reusableError ? (
        <InlineMessage tone="warning" className="mb-3">
          Your saved signature could not be loaded. You can still draw or upload
          a signature for this request.
        </InlineMessage>
      ) : null}

      {confirmError ? (
        <InlineMessage tone="error" className="mb-3">
          {confirmError}
        </InlineMessage>
      ) : null}

      {!isLoading && !membersError ? (
        <>
          {/* Prepared group */}
          <div className="sig-group">
            <h3 className="sig-group-title">Prepared and Compiled By</h3>
            <div className="sig-grid">
              {prepared.length === 0 ? (
                <p className="sig-empty">No prepared signatories configured.</p>
              ) : (
                prepared.map((member) => (
                  <SignatureBox
                    key={member.id}
                    member={member}
                    signature={signatureFor(member)}
                    reusableSignature={
                      canMemberSign(member) && !signatureFor(member)
                        ? reusableSignature
                        : null
                    }
                    canSign={canMemberSign(member)}
                    confirming={confirmingMemberId === member.id}
                    onSign={() => handleSign(member)}
                    onConfirm={() => void handleConfirmReusable(member)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Confirmed group */}
          <div className="sig-group">
            <h3 className="sig-group-title">Checked and Confirmed By</h3>
            <div className="sig-grid">
              {confirmed.length === 0 ? (
                <p className="sig-empty">No confirmed signatories configured.</p>
              ) : (
                confirmed.map((member) => (
                  <SignatureBox
                    key={member.id}
                    member={member}
                    signature={signatureFor(member)}
                    reusableSignature={
                      canMemberSign(member) && !signatureFor(member)
                        ? reusableSignature
                        : null
                    }
                    canSign={canMemberSign(member)}
                    confirming={confirmingMemberId === member.id}
                    onSign={() => handleSign(member)}
                    onConfirm={() => void handleConfirmReusable(member)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Complete Review action */}
          {canCompleteReview ? (
            <div className="rd-actions mt-3">
              {completeError ? (
                <InlineMessage tone="error" className="mb-2">
                  {completeError}
                </InlineMessage>
              ) : null}
              <button
                type="button"
                className="rd-verify-btn"
                onClick={() => void handleCompleteReview()}
                disabled={completing}
              >
                {completing ? (
                  <>
                    <Loader2 size={16} aria-hidden="true" className="sig-spin" />
                    Completing…
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={16} aria-hidden="true" />
                    Complete Review
                  </>
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Signature modal */}
      {signingMember ? (
        <SignatureModal
          show={true}
          memberName={signingMember.name}
          memberEmail={signingMember.email}
          requestId={requestId}
          contactId={currentUserContactId}
          loginHint={currentUserLoginHint}
          onHide={() => setSigningMember(null)}
          onSaved={() => void handleSigned()}
        />
      ) : null}
    </div>
  );
};

export { SignatureSection };
