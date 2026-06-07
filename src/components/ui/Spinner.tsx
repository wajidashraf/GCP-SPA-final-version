import { Loader2 } from 'lucide-react';

type SpinnerProps = {
  /** Icon size in px. */
  size?: number;
  /** Accessible label; also drives screen-reader text. */
  label?: string;
  className?: string;
};

/**
 * Brand spinner. A single lucide icon so every loading affordance in the app
 * looks identical. Decorative by default; pass a `label` when it stands alone.
 */
const Spinner = ({ size = 18, label, className = '' }: SpinnerProps) => (
  <span
    className={`ui-spinner d-inline-flex align-items-center ${className}`}
    role={label ? 'status' : undefined}
    aria-hidden={label ? undefined : true}
  >
    <Loader2 size={size} className="ui-spin" />
    {label ? <span className="visually-hidden">{label}</span> : null}
  </span>
);

export default Spinner;
export { Spinner };
export type { SpinnerProps };
