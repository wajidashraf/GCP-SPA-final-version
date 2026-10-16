import { useState } from 'react';
import { ClipboardCheck, FileText, PenLine, RefreshCw } from 'lucide-react';
import type { GcpRequest } from '../../types/request';
import type { GcpSignature } from '../../shared/services/signatureService';
import { getAcceptanceHistory, getRequestSignatureEvents } from '../../shared/requestHistory';
import type { RequestSignatureEvent } from '../../shared/requestHistory';
import { toSharePointDownloadUrl } from '../../shared/sharePointUrl';
import { extractStoredLetterText } from '../letters/letterPersistence';
import { DetailSection } from './DetailSection';
import { formatDateTime } from './valueFormat';

type RequestHistoryProps = {
  request: GcpRequest;
  signatures: GcpSignature[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
};

const SavedSignature = ({ event }: { event: RequestSignatureEvent }) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { signature, identity, kind } = event;

  return (
    <article className="rd-history-event" id={`rd-signature-${signature.id}`}>
      <div className="rd-history-image-wrap">
        <img
          key={attempt}
          data-request-signature={signature.id}
          src={toSharePointDownloadUrl(signature.signUrl)}
          alt={`Saved signature of ${identity}`}
          className="rd-history-signature-image"
          loading="eager"
          hidden={failed}
          onError={() => setFailed(true)}
        />
        {failed ? (
          <div className="rd-history-image-error" role="alert">
            <span>Saved signature image unavailable. Printing requires this image.</span>
            <div className="rd-history-retry-row no-print">
              <button type="button" className="rd-comment-cancel" onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}>
                <RefreshCw size={14} aria-hidden="true" /> Retry image
              </button>
              <a href={signature.signUrl} target="_blank" rel="noreferrer">Open saved file</a>
            </div>
          </div>
        ) : null}
      </div>
      <dl className="rd-history-event-facts">
        <div><dt className="rd-field-label">{kind === 'hoc' ? 'HOC signatory' : 'Signatory'}</dt><dd>{identity}</dd></div>
        {kind === 'signatory' && signature.signatoryEmail ? (
          <div><dt className="rd-field-label">Saved email</dt><dd>{signature.signatoryEmail}</dd></div>
        ) : null}
        <div><dt className="rd-field-label">Signing date</dt><dd>{signature.createdOn ? <time dateTime={signature.createdOn}>{formatDateTime(signature.createdOn)}</time> : 'Not recorded'}</dd></div>
      </dl>
    </article>
  );
};

/** Saved evidence only; no current template, roster, or unsigned preview is used. */
export const RequestHistory = ({ request, signatures, isLoading, error, onRetry }: RequestHistoryProps) => {
  const events = getRequestSignatureEvents(request.id, signatures);
  const hocEvents = events.filter((event) => event.kind === 'hoc');
  const acceptance = getAcceptanceHistory(request);
  const acknowledgement = extractStoredLetterText(request.ackLetterText);
  const endorsement = extractStoredLetterText(request.endorsementLetterText);

  return (
    <>
      {isLoading || error || events.length > 0 ? (
        <DetailSection title="Completed Signatures" icon={PenLine} eyebrow={events.length > 0 ? `${events.length} saved events` : undefined}>
          {isLoading ? <p className="rd-history-note" role="status">Loading saved signature history...</p> : null}
          {error ? (
            <div className="rd-history-error" role="alert">
              <p>Saved signature history could not be loaded: {error}</p>
              <button type="button" className="rd-comment-cancel no-print" onClick={() => { void onRetry(); }}>
                <RefreshCw size={14} aria-hidden="true" /> Retry history
              </button>
            </div>
          ) : null}
          {events.map((event) => <SavedSignature key={event.signature.id} event={event} />)}
        </DetailSection>
      ) : null}

      {acceptance ? (
        <DetailSection title="HOC Acceptance" icon={ClipboardCheck}>
          <dl className="rd-grid">
            <div className="rd-field"><dt className="rd-field-label">Saved acceptance date</dt><dd className="rd-field-value">{acceptance.date ? <time dateTime={acceptance.date}>{formatDateTime(acceptance.date)}</time> : 'Not recorded'}</dd></div>
            <div className="rd-field"><dt className="rd-field-label">Acceptance conclusion</dt><dd className="rd-field-value">{acceptance.conclusionCodes.length > 0 ? acceptance.conclusionCodes.map((code) => `Code ${code}`).join(', ') : 'Not recorded'}</dd></div>
            {acceptance.legacyComment ? (
              <div className="rd-field rd-field--full"><dt className="rd-field-label">Saved legacy comment</dt><dd className="rd-field-value rd-multiline">{acceptance.legacyComment}</dd></div>
            ) : null}
          </dl>
          <p className="rd-history-note">The saved acceptance contains the conclusion and date. The original form, accepting user's identity, and signature used were not recorded. Related HOC signatures are listed separately below.</p>
          {isLoading ? <p className="rd-history-note" role="status">Loading related HOC signature events...</p> : error ? (
            <p className="rd-history-error">Related HOC signature events are unavailable. Retry the signature history above.</p>
          ) : hocEvents.length > 0 ? (
            <div className="rd-history-related">
              <p className="rd-field-label">Related saved HOC signature events</p>
              <ul>{hocEvents.map(({ signature, identity }) => (
                <li key={signature.id}><a href={`#rd-signature-${signature.id}`}>{identity} — {signature.createdOn ? formatDateTime(signature.createdOn) : 'Date not recorded'}</a></li>
              ))}</ul>
            </div>
          ) : <p className="rd-history-note">No related saved HOC signature event is available.</p>}
        </DetailSection>
      ) : null}

      {acknowledgement.trim() ? (
        <DetailSection title="Acknowledgement Letter" icon={FileText}>
          <dl className="rd-grid"><div className="rd-field rd-field--full"><dt className="rd-field-label">Saved acknowledgement date</dt><dd className="rd-field-value">{request.acknowledgementDate ? <time dateTime={request.acknowledgementDate}>{formatDateTime(request.acknowledgementDate)}</time> : 'Not recorded'}</dd></div></dl>
          <div className="rd-multiline rd-history-letter">{acknowledgement}</div>
        </DetailSection>
      ) : null}

      {endorsement.trim() ? (
        <DetailSection title="Endorsement Letter" icon={FileText}>
          <dl className="rd-grid"><div className="rd-field rd-field--full"><dt className="rd-field-label">Saved endorsement date</dt><dd className="rd-field-value">{request.endorsementDate ? <time dateTime={request.endorsementDate}>{formatDateTime(request.endorsementDate)}</time> : 'Not recorded'}</dd></div></dl>
          <div className="rd-multiline rd-history-letter">{endorsement}</div>
        </DetailSection>
      ) : null}
    </>
  );
};

export type { RequestHistoryProps };
