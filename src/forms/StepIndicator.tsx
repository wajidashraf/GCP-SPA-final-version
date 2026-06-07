import { Check, MoreHorizontal } from 'lucide-react';

type StepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  stepDescriptions?: string[];
  maxVisible?: number;
  className?: string;
};

const getVisibleSteps = (
  currentStep: number,
  totalSteps: number,
  maxVisible: number
): number[] => {
  if (totalSteps <= maxVisible) {
    return Array.from({ length: totalSteps }, (_, i) => i + 1);
  }
  const safe = Math.min(Math.max(currentStep, 1), totalSteps);
  const maxStart = totalSteps - (maxVisible - 1);
  let start = safe - 1;
  if (start < 1) start = 1;
  if (start > maxStart) start = maxStart;
  return Array.from({ length: maxVisible }, (_, i) => start + i);
};

const StepIndicator = ({
  currentStep,
  totalSteps,
  stepLabels = [],
  stepDescriptions = [],
  maxVisible = 4,
  className = '',
}: StepIndicatorProps) => {
  const visible = getVisibleSteps(currentStep, totalSteps, maxVisible);
  const firstVisible = visible[0];
  const lastVisible = visible[visible.length - 1];

  return (
    <nav
      aria-label="Form progress"
      className={`step-indicator d-flex align-items-center justify-content-center flex-wrap gap-2 py-3 ${className}`}
    >
      {firstVisible > 1 ? (
        <span className="text-muted d-flex align-items-center" aria-hidden="true">
          <MoreHorizontal size={18} />
        </span>
      ) : null}
      {visible.map((stepNumber, idx) => {
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const label = stepLabels[stepNumber - 1] ?? `Step ${stepNumber}`;
        const description = stepDescriptions[stepNumber - 1];
        const nodeClass = isActive
          ? 'is-active'
          : isCompleted
            ? 'is-complete'
            : '';
        return (
          <div
            key={stepNumber}
            className="d-flex align-items-center"
            aria-current={isActive ? 'step' : undefined}
          >
            <div className="d-flex flex-column align-items-center" style={{ minWidth: 90 }}>
              <span className={`step-node ${nodeClass}`}>
                {isCompleted ? <Check size={18} aria-hidden="true" /> : stepNumber}
              </span>
              <span className={`step-label ${isActive ? 'is-active' : ''}`}>
                {label}
              </span>
              {description ? (
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                  {description}
                </span>
              ) : null}
            </div>
            {idx < visible.length - 1 ? (
              <span
                className={`step-connector ${stepNumber < currentStep ? 'is-complete' : ''}`}
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
      {lastVisible < totalSteps ? (
        <span className="text-muted d-flex align-items-center" aria-hidden="true">
          <MoreHorizontal size={18} />
        </span>
      ) : null}
    </nav>
  );
};

export default StepIndicator;
export { StepIndicator };
export type { StepIndicatorProps };
