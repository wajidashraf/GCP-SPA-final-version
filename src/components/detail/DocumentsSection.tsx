// src/components/detail/DocumentsSection.tsx
// The request-level "Documents" card shown near the top of the Request Detail
// page. Lists every document that belongs to the request itself (field: null)
// as a strip of file cards with preview + download.

import { Paperclip } from 'lucide-react';
import type { DocumentLink } from '../../shared/documents';
import DetailSection from './DetailSection';
import DocumentStrip from './DocumentStrip';

type DocumentsSectionProps = {
  documents: DocumentLink[];
};

const DocumentsSection = ({ documents }: DocumentsSectionProps) => {
  if (documents.length === 0) return null;

  return (
    <DetailSection
      title="Documents"
      icon={Paperclip}
      eyebrow={String(documents.length)}
    >
      <DocumentStrip documents={documents} />
    </DetailSection>
  );
};

export default DocumentsSection;
export { DocumentsSection };
export type { DocumentsSectionProps };
