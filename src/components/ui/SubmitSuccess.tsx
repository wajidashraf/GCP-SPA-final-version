import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

type SubmitSuccessProps = {
  title?: string;
  message?: ReactNode;
  /** Optional reference shown in a highlighted chip, e.g. a request number. */
  reference?: string;
  referenceLabel?: string;
  /** Action buttons (already-styled), rendered in a row below the message. */
  actions?: ReactNode;
};

/**
 * Full-panel confirmation shown after a successful submission. Gives the user
 * an unmistakable success signal and their reference number, rather than a
 * silent redirect.
 */
const SubmitSuccess = ({
  title = 'Request submitted',
  message = 'Thanks — your request has been received and is now being processed.',
  reference,
  referenceLabel = 'Reference',
  actions,
}: SubmitSuccessProps) => (
  <div className="ui-success" role="status" aria-live="polite">
    <span className="ui-success-icon" aria-hidden="true">
      <CheckCircle2 size={34} />
    </span>
    <h2 className="ui-success-title">{title}</h2>
    <p className="ui-success-msg">{message}</p>
    {reference ? (
      <p className="ui-success-ref">
        {referenceLabel}: <strong>{reference}</strong>
      </p>
    ) : null}
    {actions ? <div className="ui-success-actions">{actions}</div> : null}
  </div>
);

export default SubmitSuccess;
export { SubmitSuccess };
export type { SubmitSuccessProps };
