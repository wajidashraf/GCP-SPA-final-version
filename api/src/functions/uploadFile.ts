// HTTP trigger: POST /api/uploadFile
//
// Flow:
//   1. Validate the Entra bearer token (FE → Function) and required scope.
//   2. Parse the multipart/form-data body: `file` + optional metadata fields.
//   3. Enforce size / type limits.
//   4. Upload to SharePoint via Microsoft Graph (Function → SharePoint).
//   5. Return the created file's { id, name, webUrl } so the SPA can persist it.
//
// authLevel is 'anonymous' on purpose — we authenticate with the Entra bearer
// token, NOT a Function key (a key would have to be embedded in browser JS).
// CORS is configured on the Function App (and local.settings.json for dev).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateToken, AuthError } from '../auth/validateToken.js';
import { uploadToSharePoint } from '../sharepoint/uploadToSharePoint.js';
import { getConfig } from '../config.js';

// Allowed MIME types — matches the SPA FileUpload hint (PDF, Word, Excel, text, images).
const ALLOWED_TYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel: XLS, XLSX, XLSM
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  // Plain-text formats: TXT, CSV, Markdown
  'text/plain',
  'text/csv',
  'application/csv',
  'text/markdown',
  'text/x-markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Fallback allow-list by extension. Browsers frequently send an empty or
// generic (application/octet-stream) MIME type for CSV / Markdown / XLSM, so
// when the reported type is unusable we fall back to the file extension.
const ALLOWED_EXTENSIONS = new Set<string>([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.csv',
  '.txt',
  '.md',
  '.markdown',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
};

const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: { 'Content-Type': 'application/json' },
});

const uploadFileHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const cfg = getConfig();

  // 1. Authenticate the caller.
  let caller;
  try {
    caller = await validateToken(request.headers.get('authorization'));
  } catch (err) {
    if (err instanceof AuthError) {
      return json(err.status, { ok: false, error: err.message });
    }
    context.error('Unexpected auth error', err);
    return json(401, { ok: false, error: 'Authentication failed' });
  }

  // 2. Parse multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Expected multipart/form-data body' });
  }

  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return json(400, { ok: false, error: "Missing 'file' field in form data" });
  }

  // Optional metadata used to organise files into folders.
  const entityType = String(formData.get('entityType') ?? 'misc');
  const requestId = String(formData.get('requestId') ?? 'unsorted');
  const fieldName = formData.get('fieldName')
    ? String(formData.get('fieldName'))
    : undefined;

  // 3. Enforce limits.
  if (fileEntry.size === 0) {
    return json(400, { ok: false, error: 'File is empty' });
  }
  if (fileEntry.size > cfg.maxFileBytes) {
    return json(413, {
      ok: false,
      error: `File exceeds the ${Math.round(cfg.maxFileBytes / 1024 / 1024)} MB limit`,
    });
  }
  // Accept if the reported MIME type is allowed, OR (when the browser sends an
  // empty / generic type) if the file extension is on the allow-list.
  const ext = getExtension(fileEntry.name);
  const typeAllowed = fileEntry.type && ALLOWED_TYPES.has(fileEntry.type);
  const extAllowed = ALLOWED_EXTENSIONS.has(ext);
  const typeIsGeneric = !fileEntry.type || fileEntry.type === 'application/octet-stream';

  if (!typeAllowed && !(typeIsGeneric && extAllowed)) {
    return json(415, {
      ok: false,
      error: `Unsupported file type: ${fileEntry.type || ext || 'unknown'}`,
    });
  }

  // 4. Upload to SharePoint.
  try {
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const subFolders = [entityType, requestId];
    const result = await uploadToSharePoint(fileEntry.name, buffer, subFolders);

    context.log(
      `Uploaded '${fileEntry.name}' (${buffer.length} bytes) for ${caller.upn || caller.contactId} → ${result.webUrl}`
    );

    // 5. Return the persisted location.
    return json(200, {
      ok: true,
      file: {
        id: result.id,
        name: result.name,
        webUrl: result.webUrl,
        size: result.size,
        originalName: fileEntry.name,
        contentType: fileEntry.type || 'application/octet-stream',
        fieldName,
      },
    });
  } catch (err) {
    context.error('SharePoint upload failed', err);
    return json(502, {
      ok: false,
      error: 'Upload to SharePoint failed. Please try again or contact support.',
    });
  }
};

app.http('uploadFile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'uploadFile',
  handler: uploadFileHandler,
});
