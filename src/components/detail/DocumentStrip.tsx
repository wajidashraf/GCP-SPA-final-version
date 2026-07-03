// src/components/detail/DocumentStrip.tsx
// A horizontal strip of DocumentCards sharing one preview modal. Reused for the
// request-level "Documents" section and for per-field document groups.

import { useState } from 'react';
import type { DocumentLink } from '../../shared/documents';
import DocumentCard from './DocumentCard';
import DocumentPreviewModal from './DocumentPreviewModal';

type DocumentStripProps = {
  documents: DocumentLink[];
  /** When provided, each card shows a remove action (edit mode). */
  onRemove?: (doc: DocumentLink) => void;
};

const DocumentStrip = ({ documents, onRemove }: DocumentStripProps) => {
  const [preview, setPreview] = useState<DocumentLink | null>(null);

  if (documents.length === 0) return null;

  return (
    <>
      <div className="rd-doc-strip">
        {documents.map((doc, i) => (
          <DocumentCard
            key={`${doc.url}-${i}`}
            doc={doc}
            onPreview={setPreview}
            onRemove={onRemove}
          />
        ))}
      </div>
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
    </>
  );
};

export default DocumentStrip;
export { DocumentStrip };
export type { DocumentStripProps };
