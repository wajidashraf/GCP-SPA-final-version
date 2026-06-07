// src/components/detail/DocumentCard.tsx
// Read-only file card for a stored document link. Mirrors the upload-time chip
// in src/forms/FileUpload.tsx — a file-type tile with a truncated name below —
// plus always-visible preview and download actions.

import { Download, Eye, FileText } from 'lucide-react';
import type { DocumentLink } from '../../shared/documents';
import { extColor, getExt, isImage, truncateName } from './documentMeta';

type DocumentCardProps = {
  doc: DocumentLink;
  onPreview: (doc: DocumentLink) => void;
};

// Append ?download=1 so SharePoint responds with Content-Disposition: attachment
// instead of redirecting to its web preview page.
const toDownloadUrl = (url: string): string =>
  url.includes('?') ? `${url}&download=1` : `${url}?download=1`;

const DocumentCard = ({ doc, onPreview }: DocumentCardProps) => {
  const ext = getExt(doc.name);
  const color = extColor(doc.name);

  return (
    <div className="rd-doc-card">
      <div className="rd-doc-media">
        {isImage(doc.name) ? (
          <img className="rd-doc-thumb" src={doc.url} alt={doc.name} />
        ) : (
          <div className="rd-doc-icon" style={{ color }}>
            <FileText size={24} aria-hidden="true" />
            <span className="rd-doc-ext">{ext ? ext.toUpperCase() : 'FILE'}</span>
          </div>
        )}

        <div className="rd-doc-actions">
          <button
            type="button"
            className="rd-doc-action"
            onClick={() => onPreview(doc)}
            title="Preview"
            aria-label={`Preview ${doc.name}`}
          >
            <Eye size={12} aria-hidden="true" />
          </button>
          <a
            className="rd-doc-action"
            href={toDownloadUrl(doc.url)}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            aria-label={`Download ${doc.name}`}
          >
            <Download size={12} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="rd-doc-name" title={doc.name}>
        {truncateName(doc.name)}
      </div>
    </div>
  );
};

export default DocumentCard;
export { DocumentCard };
export type { DocumentCardProps };
