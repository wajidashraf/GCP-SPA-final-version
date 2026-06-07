import Spinner from './Spinner';

type LoadingStateProps = {
  /** Primary, user-friendly line — e.g. "Loading your requests…". */
  message?: string;
  /** Optional second line for context. */
  hint?: string;
  /** Vertical padding size. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * Centered loading panel for page- and section-level waits. Keep the message
 * plain-language and reassuring — never a technical status.
 */
const LoadingState = ({
  message = 'Loading…',
  hint,
  size = 'md',
  className = '',
}: LoadingStateProps) => (
  <div
    className={`ui-loading ui-loading--${size} ${className}`}
    role="status"
    aria-live="polite"
  >
    <Spinner size={size === 'lg' ? 30 : size === 'sm' ? 18 : 24} />
    <p className="ui-loading-msg">{message}</p>
    {hint ? <p className="ui-loading-hint">{hint}</p> : null}
  </div>
);

export default LoadingState;
export { LoadingState };
export type { LoadingStateProps };
