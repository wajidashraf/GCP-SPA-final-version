import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Loader2, MessageSquarePlus, X } from 'lucide-react';
import { TextAreaField } from '../../forms';
import { InlineMessage } from '../ui';
import { createSuggestion } from '../../shared/services/suggestionService';

type AddSuggestionModalProps = {
  show: boolean;
  requestId: string;
  contactId: string | null;
  currentUserName: string;
  onHide: () => void;
  onSaved: () => void;
};

const AddSuggestionModal = ({
  show,
  requestId,
  contactId,
  currentUserName,
  onHide,
  onSaved,
}: AddSuggestionModalProps) => {
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setSuggestionText('');
      setError(null);
    }
  }, [show]);

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSubmit = async () => {
    setError(null);
    const text = suggestionText.trim();
    if (!text) {
      setError('Please enter your suggestion before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await createSuggestion({ requestId, contactId, suggestionText: text, suggestionBy: currentUserName });
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to submit suggestion: ${err.message}`
          : 'Failed to submit suggestion. Please try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
      dialogClassName="slot-modal-dialog"
      aria-labelledby="add-suggestion-title"
    >
      <div className="slot-modal">
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <MessageSquarePlus size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="add-suggestion-title" className="slot-modal-title">
              Add Suggestion
            </h2>
            <p className="slot-modal-sub">
              Submit a review suggestion for this request
            </p>
          </div>
          <button
            type="button"
            className="slot-modal-close"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="slot-modal-body">
          {error ? (
            <InlineMessage tone="error" title="Couldn't submit" className="mb-3">
              {error}
            </InlineMessage>
          ) : null}

          <TextAreaField
            name="suggestionText"
            label="Suggestion"
            isRequired
            placeholder="Describe your suggestion or recommendation for this request…"
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            isReadOnly={submitting}
            helpText="Be specific — your suggestion will be reviewed by admin/reviewer before acceptance."
            rows={5}
          />
        </div>

        <footer className="slot-modal-foot">
          <button
            type="button"
            className="slot-btn slot-btn-ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="slot-btn slot-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="rq-spinner" aria-hidden="true" />
                Submitting…
              </>
            ) : (
              <>
                <MessageSquarePlus size={16} aria-hidden="true" />
                Submit Suggestion
              </>
            )}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default AddSuggestionModal;
export { AddSuggestionModal };
