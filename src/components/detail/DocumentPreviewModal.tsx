// src/components/detail/DocumentPreviewModal.tsx
// In-app preview for a stored document link. Images render inline, PDFs embed in
// an iframe; anything else (Office/text) shows a fallback with an open/download
// action, since those can't be embedded reliably from SharePoint cross-origin.

import Modal from 'react-bootstrap/Modal';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import type { DocumentLink } from '../../shared/documents';
import { isImage, isPdf } from './documentMeta';

type DocumentPreviewModalProps = {
  /** The document to preview, or null to keep the modal closed. */
  doc: DocumentLink | null;
  onClose: () => void;
};

const DocumentPreviewModal = ({ doc, onClose }: DocumentPreviewModalProps) => {
  const show = doc !== null;

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="lg"
      dialogClassName="rd-doc-preview-dialog"
      aria-labelledby="rd-doc-preview-title"
    >
      {doc ? (
        <div className="rd-doc-preview">
          <div className="rd-doc-preview-head">
            <h2 id="rd-doc-preview-title" className="rd-doc-preview-title" title={doc.name}>
              {doc.name}
            </h2>
            <div className="rd-doc-preview-actions">
              <a
                className="rd-doc-preview-btn"
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Download"
                aria-label={`Download ${doc.name}`}
              >
                <Download size={16} aria-hidden="true" />
              </a>
              <button
                type="button"
                className="rd-doc-preview-btn"
                onClick={onClose}
                title="Close"
                aria-label="Close preview"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rd-doc-preview-body">
            {isImage(doc.name) ? (
              <img className="rd-doc-preview-img" src={doc.url} alt={doc.name} />
            ) : isPdf(doc.name) ? (
              <iframe className="rd-doc-preview-frame" src={doc.url} title={doc.name} />
            ) : (
              <div className="rd-doc-preview-fallback">
                <FileText size={40} aria-hidden="true" />
                <p>This file type can't be previewed here.</p>
                <a
                  className="rd-doc-open-link"
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  Open file
                </a>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default DocumentPreviewModal;
export { DocumentPreviewModal };
export type { DocumentPreviewModalProps };
