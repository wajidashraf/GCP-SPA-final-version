// Contract for the gcp_request.gcp_documentsurl column.
//
// A request stores ALL of its uploaded document links in this single column as
// a JSON array. Each link is tagged with the form field it was uploaded
// against; links with no field (e.g. documents added on the final step) belong
// to the request itself.
//
//   [
//     { "field": "projectOrgManpowerChart", "name": "chart.pdf", "url": "https://…", "id": "01ABC…" },
//     { "field": null,                       "name": "ack.pdf",   "url": "https://…", "id": "01XYZ…" }
//   ]

export interface DocumentLink {
  /** Form field key the file maps to, or null when it belongs to the request. */
  field: string | null;
  /** Original file name. */
  name: string;
  /** SharePoint web URL. */
  url: string;
  /** SharePoint drive-item id (optional). */
  id?: string;
  /** ISO upload timestamp (optional). */
  uploadedAt?: string;
}

/** Minimal shape of an uploaded file we can turn into a DocumentLink. */
export interface UploadedRef {
  name: string;
  url?: string;
  id?: string;
}

/** Safely parse the stored column value into links. Returns [] on null/invalid. */
export const parseDocuments = (raw: string | null | undefined): DocumentLink[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d): d is DocumentLink => !!d && typeof d.url === 'string')
      .map((d) => ({
        field: d.field ?? null,
        name: typeof d.name === 'string' ? d.name : 'document',
        url: d.url,
        id: typeof d.id === 'string' ? d.id : undefined,
        uploadedAt: typeof d.uploadedAt === 'string' ? d.uploadedAt : undefined,
      }));
  } catch {
    return [];
  }
};

/** Serialize links for storage. Returns null when there are none (keeps the column clean). */
export const serializeDocuments = (links: DocumentLink[]): string | null =>
  links.length > 0 ? JSON.stringify(links) : null;

/**
 * Build links for one field from its completed uploads (those that have a url).
 * Pass `field: null` for request-level documents.
 */
export const documentsFromUploads = (
  uploads: readonly UploadedRef[],
  field: string | null,
  uploadedAt?: string
): DocumentLink[] =>
  uploads
    .filter((u): u is UploadedRef & { url: string } => typeof u.url === 'string' && u.url.length > 0)
    .map((u) => ({ field, name: u.name, url: u.url, id: u.id, uploadedAt }));

/** Group links for display: per-field buckets + a request-level bucket. */
export const groupDocuments = (
  links: DocumentLink[]
): { byField: Record<string, DocumentLink[]>; request: DocumentLink[] } => {
  const byField: Record<string, DocumentLink[]> = {};
  const request: DocumentLink[] = [];
  for (const link of links) {
    if (link.field) {
      (byField[link.field] ??= []).push(link);
    } else {
      request.push(link);
    }
  }
  return { byField, request };
};

/** All links uploaded against a specific field. */
export const documentsForField = (
  links: DocumentLink[],
  field: string
): DocumentLink[] => links.filter((l) => l.field === field);
