// Uploads a single file to a SharePoint document library via Microsoft Graph.
//
// - Files <= 4 MiB use a simple PUT /content.
// - Larger files use a resumable upload session (chunked), per Graph limits.
// - Site and drive ids are resolved once and cached per warm Function instance.
// - Duplicate names are auto-renamed (conflictBehavior: rename) so uploads
//   never silently overwrite an existing file.

import { getGraphClient } from './graphClient.js';
import { getConfig } from '../config.js';

const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024; // 4 MiB
// Chunk size MUST be a multiple of 320 KiB (327680 bytes) for upload sessions.
const CHUNK_SIZE = 327680 * 16; // 5 MiB

export interface UploadResult {
  id: string;
  name: string;
  webUrl: string;
  size: number;
}

// SharePoint forbids these characters in file/folder names, plus leading/
// trailing whitespace and dots.
const sanitizeSegment = (raw: string): string => {
  const cleaned = raw
    .replace(/[\\/:*?"<>|#%]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  return cleaned.length > 0 ? cleaned : 'file';
};

const buildItemPath = (folderSegments: string[], fileName: string): string => {
  const segments = [...folderSegments.map(sanitizeSegment), sanitizeSegment(fileName)];
  // Graph drive path addressing: /root:/a/b/c.ext
  return segments.map(encodeURIComponent).join('/');
};

// ── Resolve site + drive once, then cache ───────────────────────────────────
let cachedSiteId: string | null = null;
let cachedDriveId: string | null = null;

const resolveSiteId = async (): Promise<string> => {
  if (cachedSiteId) return cachedSiteId;
  const cfg = getConfig();

  // Preferred: a pre-resolved site id from app settings.
  if (cfg.sharepointSiteId) {
    cachedSiteId = cfg.sharepointSiteId;
    return cachedSiteId;
  }

  if (!cfg.sharepointHostname || !cfg.sharepointSitePath) {
    throw new Error(
      'SharePoint site is not configured. Set SHAREPOINT_SITE_ID, or SHAREPOINT_HOSTNAME + SHAREPOINT_SITE_PATH.'
    );
  }

  const client = getGraphClient();
  // GET /sites/{hostname}:{server-relative-path}
  const site = await client
    .api(`/sites/${cfg.sharepointHostname}:${cfg.sharepointSitePath}`)
    .get();
  if (!site?.id) {
    throw new Error(
      `Could not resolve SharePoint site for ${cfg.sharepointHostname}${cfg.sharepointSitePath}`
    );
  }
  cachedSiteId = site.id as string;
  return cachedSiteId;
};

const resolveDriveId = async (): Promise<string> => {
  if (cachedDriveId) return cachedDriveId;
  const cfg = getConfig();

  // Preferred: a pre-resolved drive id from app settings.
  if (cfg.sharepointDriveId) {
    cachedDriveId = cfg.sharepointDriveId;
    return cachedDriveId;
  }

  const client = getGraphClient();
  const siteId = await resolveSiteId();

  // Find the document library (drive) whose name matches SHAREPOINT_LIBRARY.
  const drives = await client.api(`/sites/${siteId}/drives`).get();
  const list: Array<{ id: string; name: string }> = drives?.value ?? [];
  const match = list.find(
    (d) => d.name?.toLowerCase() === cfg.sharepointLibrary.toLowerCase()
  );

  if (match?.id) {
    cachedDriveId = match.id;
    return cachedDriveId;
  }

  // Fall back to the site's default drive.
  const defaultDrive = await client.api(`/sites/${siteId}/drive`).get();
  if (!defaultDrive?.id) {
    throw new Error(
      `Could not resolve a drive for library '${cfg.sharepointLibrary}' on the site`
    );
  }
  cachedDriveId = defaultDrive.id as string;
  return cachedDriveId;
};

const simpleUpload = async (
  driveId: string,
  itemPath: string,
  content: Buffer
): Promise<UploadResult> => {
  const client = getGraphClient();
  const item = await client
    .api(`/drives/${driveId}/root:/${itemPath}:/content`)
    .query({ '@microsoft.graph.conflictBehavior': 'rename' })
    .put(content);
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    size: item.size ?? content.length,
  };
};

const chunkedUpload = async (
  driveId: string,
  itemPath: string,
  content: Buffer
): Promise<UploadResult> => {
  const client = getGraphClient();
  const session = await client
    .api(`/drives/${driveId}/root:/${itemPath}:/createUploadSession`)
    .post({
      item: { '@microsoft.graph.conflictBehavior': 'rename' },
    });

  const uploadUrl: string = session.uploadUrl;
  const total = content.length;
  let start = 0;
  let lastItem: any = null;

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    // Copy into a fresh Uint8Array — a valid fetch BodyInit (Buffer isn't typed as one).
    const chunk = new Uint8Array(content.subarray(start, end));
    // The uploadUrl is pre-authenticated — no Authorization header required.
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    if (res.status === 200 || res.status === 201) {
      lastItem = await res.json(); // final chunk returns the driveItem
    } else if (res.status === 202) {
      // Accepted — more chunks expected.
    } else {
      const text = await res.text();
      throw new Error(`Upload session chunk failed (${res.status}): ${text}`);
    }
    start = end;
  }

  if (!lastItem?.id) {
    throw new Error('Upload session completed without returning a drive item');
  }
  return {
    id: lastItem.id,
    name: lastItem.name,
    webUrl: lastItem.webUrl,
    size: lastItem.size ?? total,
  };
};

/**
 * Upload `content` to `<SHAREPOINT_ROOT_FOLDER>/<...subFolders>/<fileName>`
 * in the configured document library. Returns the created item's webUrl/id.
 */
export const uploadToSharePoint = async (
  fileName: string,
  content: Buffer,
  subFolders: string[] = []
): Promise<UploadResult> => {
  const cfg = getConfig();
  const driveId = await resolveDriveId();
  const folders = [cfg.sharepointRootFolder, ...subFolders].filter(Boolean);
  const itemPath = buildItemPath(folders, fileName);

  return content.length <= SIMPLE_UPLOAD_MAX
    ? simpleUpload(driveId, itemPath, content)
    : chunkedUpload(driveId, itemPath, content);
};
