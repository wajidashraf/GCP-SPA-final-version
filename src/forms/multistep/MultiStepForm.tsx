import { useEffect, useState, type ReactNode } from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Send, TriangleAlert } from 'lucide-react';
import StepIndicator from '../StepIndicator';
import { InlineMessage, Spinner, SubmitSuccess } from '../../components/ui';

/** Transient confirmation banner a form's onSubmit can surface (reuses .eng-toast). */
type SubmitToast = { message: string; tone?: 'success' | 'error' };

type StepDefinition = {
  label: string;
  description?: string;
  render: () => ReactNode;
  validate?: () => string | null;
};

/** What a form's `onSubmit` may return so the shell can show a confirmation. */
type SubmitResult = { reference?: string; toast?: SubmitToast } | void;

type MultiStepFormProps = {
  title: string;
  subtitle?: string;
  steps: StepDefinition[];
  submitLabel?: string;
  isSubmitting?: boolean;
  /**
   * Submit handler. On success it may return `{ reference }` and the shell will
   * render a branded confirmation screen. If it throws/rejects, the shell shows
   * an inline error and lets the user retry — no per-form `alert()` needed.
   */
  onSubmit: () => Promise<SubmitResult> | SubmitResult;
  /** Confirmation-screen copy (sensible defaults provided). */
  successTitle?: string;
  successMessage?: ReactNode;
  successReferenceLabel?: string;
  successActionLabel?: string;
  /**
   * Overrides the success screen's primary button action. When provided, the
   * button calls this instead of navigating to the requests list — used by edit
   * mode to return to the request detail page.
   */
  onSuccessAction?: () => void;
};

const DEFAULT_SUBMIT_ERROR =
  'We couldn’t submit your request. Please check your connection and try again.';

const MultiStepForm = ({
  title,
  subtitle,
  steps,
  submitLabel = 'Submit Request',
  isSubmitting = false,
  onSubmit,
  successTitle = 'Request submitted',
  successMessage = 'Your request has been received and is now in the review queue. You can track its progress anytime in My Requests.',
  successReferenceLabel = 'Request',
  successActionLabel = 'View my requests',
  onSuccessAction,
}: MultiStepFormProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reference?: string } | null>(null);
  const [toast, setToast] = useState<SubmitToast | null>(null);

  // Auto-dismiss the toast a few seconds after it appears.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalSteps = steps.length;
  const step = steps[currentStep - 1];
  const isLast = currentStep === totalSteps;
  const progress = Math.round((currentStep / totalSteps) * 100);

  const tryAdvance = () => {
    const message = step.validate?.() ?? null;
    if (message) {
      setError(message);
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!tryAdvance()) return;
    setCurrentStep((s) => Math.min(s + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!tryAdvance()) return;
    setSubmitError(null);
    try {
      const result = await onSubmit();
      const data = result && typeof result === 'object' ? result : {};
      if (data.toast) setToast(data.toast);
      setSuccess({ reference: data.reference });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message ? err.message : DEFAULT_SUBMIT_ERROR
      );
    }
  };

  const toastEl = toast ? (
    <div
      className="eng-toast"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      style={toast.tone === 'error' ? { background: '#dc2626' } : undefined}
    >
      {toast.tone === 'error' ? (
        <TriangleAlert size={16} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={16} aria-hidden="true" />
      )}
      {toast.message}
    </div>
  ) : null;

  if (success) {
    return (
      <>
        <Card>
          <Card.Body className="p-4 p-md-5">
            <SubmitSuccess
              title={successTitle}
              message={successMessage}
              reference={success.reference}
              referenceLabel={successReferenceLabel}
              actions={
                <Button
                  variant="primary"
                  onClick={() =>
                    onSuccessAction
                      ? onSuccessAction()
                      : navigate(
                          success.reference
                            ? `/requests?submitted=${success.reference}`
                            : '/requests'
                        )
                  }
                >
                  {successActionLabel}
                </Button>
              }
            />
          </Card.Body>
        </Card>
        {toastEl}
      </>
    );
  }

  return (
    <>
      <Card>
      <Card.Body className="p-4 p-md-5">
        <div className="mb-3">
          <h2 className="h4 fw-bold mb-1">{title}</h2>
          {subtitle ? <p className="text-muted mb-2">{subtitle}</p> : null}
          <div
            className="msf-progress"
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Step ${currentStep} of ${totalSteps}`}
          >
            <span className="msf-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <StepIndicator
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepLabels={steps.map((s) => s.label)}
        />

        <div className="msf-step mt-3" key={currentStep}>
          {step.render()}
        </div>

        {error ? (
          <InlineMessage tone="error" className="mt-3">
            {error}
          </InlineMessage>
        ) : null}

        {submitError ? (
          <InlineMessage
            tone="error"
            title="Couldn’t submit"
            className="mt-3"
            onDismiss={() => setSubmitError(null)}
          >
            {submitError}
          </InlineMessage>
        ) : null}

        <div className="msf-actions">
          <Button
            variant="outline-secondary"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="d-inline-flex align-items-center gap-1"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </Button>

          {isLast ? (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="d-inline-flex align-items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size={16} />
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={16} aria-hidden="true" />
                  {submitLabel}
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={isSubmitting}
              className="d-inline-flex align-items-center gap-1"
            >
              Next
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
      {toastEl}
    </>
  );
};

export default MultiStepForm;
export { MultiStepForm };
export type { MultiStepFormProps, StepDefinition, SubmitResult };
