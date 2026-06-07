// Frontend client for the upload Azure Function.
// Acquires an Entra bearer token (via MSAL), then POSTs the file as
// multipart/form-data with upload-progress reporting (XHR, since fetch can't
// report upload progress).

import { acquirePortalToken } from './portalToken';
import { uploadConfig } from './uploadConfig';

export interface UploadMeta {
  /** Which form / table the file belongs to, e.g. 'caa', 'jvp'. Used for foldering. */
  entityType: string;
  /** Record id (real GUID once saved, or a draft id while filling the form). */
  requestId: string;
  /** Logical field the file maps to — echoed back in the response. */
  fieldName?: string;
  /** Portal user email, used as MSAL loginHint for silent SSO. */
  loginHint?: string;
}

export interface UploadedFileResult {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  originalName: string;
  contentType: string;
  fieldName?: string;
}

type ProgressFn = (percent: number) => void;

/**
 * Upload one file to SharePoint via the Function. Resolves with the created
 * file's SharePoint metadata (webUrl/id) on success.
 */
export const uploadFileToSharePoint = async (
  file: File,
  meta: UploadMeta,
  onProgress?: ProgressFn
): Promise<UploadedFileResult> => {
  const token = await acquirePortalToken();

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('entityType', meta.entityType);
  form.append('requestId', meta.requestId);
  if (meta.fieldName) form.append('fieldName', meta.fieldName);

  return new Promise<UploadedFileResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadConfig.uploadEndpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: { ok?: boolean; error?: string; file?: UploadedFileResult } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok && body.file) {
        resolve(body.file);
      } else {
        reject(new Error(body?.error ?? `Upload failed (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.send(form);
  });
};

/**
 * Convenience factory matching the `uploader` prop shape expected by
 * <FileUpload />. Bind the metadata once, pass the result straight in:
 *
 *   <FileUpload uploader={makeSharePointUploader({ entityType: 'caa', requestId, loginHint })} />
 */
export const makeSharePointUploader =
  (meta: UploadMeta) =>
  (file: File, onProgress: ProgressFn): Promise<UploadedFileResult> =>
    uploadFileToSharePoint(file, meta, onProgress);

export type FileUploader = ReturnType<typeof makeSharePointUploader>;
