import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import Spinner from './Spinner';

type MessageTone = 'success' | 'error' | 'warning' | 'info' | 'loading';

type InlineMessageProps = {
  tone: MessageTone;
  /** Optional bold lead-in (e.g. "Couldn't submit"). */
  title?: string;
  children?: ReactNode;
  /** Show a close affordance and call this when dismissed. */
  onDismiss?: () => void;
  className?: string;
};

const ICONS: Record<MessageTone, ReactNode> = {
  success: <CheckCircle2 size={18} aria-hidden="true" />,
  error: <XCircle size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
  loading: <Spinner size={18} />,
};

/**
 * Inline status banner used for loading / success / validation / error states.
 * Replaces ad-hoc `alert()` calls and bespoke `.alert-*` markup with one
 * consistent, branded, accessible component.
 */
const InlineMessage = ({
  tone,
  title,
  children,
  onDismiss,
  className = '',
}: InlineMessageProps) => (
  <div
    className={`ui-msg ui-msg--${tone} ${className}`}
    role={tone === 'error' ? 'alert' : 'status'}
    aria-live={tone === 'error' ? 'assertive' : 'polite'}
  >
    <span className="ui-msg-icon">{ICONS[tone]}</span>
    <div className="ui-msg-body">
      {title ? <span className="ui-msg-title">{title}</span> : null}
      {children ? <span className="ui-msg-text">{children}</span> : null}
    </div>
    {onDismiss ? (
      <button
        type="button"
        className="ui-msg-close"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        <X size={16} aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

export default InlineMessage;
export { InlineMessage };
export type { InlineMessageProps, MessageTone };
