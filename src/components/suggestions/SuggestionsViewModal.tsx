import Modal from 'react-bootstrap/Modal';
import { CheckCircle2, Clock, Edit, MessageSquare, User, X } from 'lucide-react';
import type { GcpSuggestion } from '../../shared/services/suggestionService';

type SuggestionsViewModalProps = {
  show: boolean;
  requestId: string;
  suggestions: GcpSuggestion[];
  onHide: () => void;
  /** Called when "Edit Review" is clicked — parent should close modal and navigate. */
  onEditReview?: () => void;
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name: string | null): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const SuggestionsViewModal = ({
  show,
  suggestions,
  onHide,
  onEditReview,
}: SuggestionsViewModalProps) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="slot-modal-dialog sugg-modal-dialog"
      aria-labelledby="suggestions-view-title"
    >
      <div className="slot-modal">
        {/* ── Header ── */}
        <header className="slot-modal-head">
          <div className="slot-modal-head-icon">
            <MessageSquare size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="suggestions-view-title" className="slot-modal-title">
              Review Suggestions
            </h2>
            <p className="slot-modal-sub">
              {suggestions.length === 0
                ? 'No suggestions yet for this request'
                : `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} submitted`}
            </p>
          </div>
          <button
            type="button"
            className="slot-modal-close"
            onClick={onHide}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="slot-modal-body sugg-modal-body">
          {suggestions.length === 0 ? (
            <div className="sugg-empty">
              <MessageSquare size={40} aria-hidden="true" />
              <p>No suggestions have been submitted for this request yet.</p>
            </div>
          ) : (
            <ul className="sugg-list" role="list">
              {suggestions.map((s) => (
                <li key={s.id} className={`sugg-card${s.suggestionAccepted ? ' sugg-card--accepted' : ''}`}>
                  {/* Avatar + Meta */}
                  <div className="sugg-card-head">
                    <span className="sugg-avatar" aria-hidden="true">
                      {getInitials(s.suggestionBy)}
                    </span>
                    <div className="sugg-meta">
                      <span className="sugg-by">
                        <User size={12} aria-hidden="true" />
                        {s.suggestionBy ?? 'Unknown'}
                      </span>
                      <span className="sugg-date">
                        <Clock size={12} aria-hidden="true" />
                        {fmtDate(s.createdOn)}
                      </span>
                    </div>
                    {s.suggestionAccepted ? (
                      <span className="sugg-accepted-badge">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Accepted
                      </span>
                    ) : null}
                  </div>

                  {/* Suggestion text */}
                  <p className="sugg-text">
                    {s.suggestionText ?? <em>No text provided</em>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="slot-modal-foot sugg-modal-foot">
          <button
            type="button"
            className="slot-btn slot-btn-ghost"
            onClick={onHide}
          >
            Close
          </button>

          {suggestions.length > 0 && onEditReview ? (
            <button
              type="button"
              className="slot-btn slot-btn-primary"
              onClick={onEditReview}
              title="Edit the review for this request"
            >
              <Edit size={16} aria-hidden="true" />
              Edit Review
            </button>
          ) : null}
        </footer>
      </div>
    </Modal>
  );
};

export default SuggestionsViewModal;
export { SuggestionsViewModal };
