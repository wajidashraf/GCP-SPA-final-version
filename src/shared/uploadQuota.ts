const MIB = 1024 * 1024;
const MAX_REQUEST_UPLOAD_BYTES = 100 * MIB;

type UploadFileLike = {
  file: { size: number };
  progress: number;
  error?: string;
  url?: string;
};

type UploadQuotaDecision = {
  allowed: boolean;
  nextBytes: number;
  remainingBytes: number;
};

type UploadReadiness = {
  ready: boolean;
  message: string | null;
};

const sumUploadBytes = (
  groups: readonly (readonly UploadFileLike[])[],
): number =>
  groups.reduce(
    (total, group) =>
      total +
      group.reduce(
        (groupTotal, upload) => groupTotal + Math.max(0, upload.file.size),
        0,
      ),
    0,
  );

const checkUploadAddition = (
  currentBytes: number,
  incomingBytes: number,
  maxBytes = MAX_REQUEST_UPLOAD_BYTES,
): UploadQuotaDecision => {
  const nextBytes = Math.max(0, currentBytes) + Math.max(0, incomingBytes);
  const allowed = nextBytes <= maxBytes;
  return {
    allowed,
    nextBytes,
    remainingBytes: Math.max(
      0,
      maxBytes - (allowed ? nextBytes : Math.max(0, currentBytes)),
    ),
  };
};

const checkUploadReplacement = (
  currentBytes: number,
  previousBytes: number,
  replacementBytes: number,
  maxBytes = MAX_REQUEST_UPLOAD_BYTES,
): UploadQuotaDecision =>
  checkUploadAddition(
    Math.max(0, currentBytes - Math.max(0, previousBytes)),
    replacementBytes,
    maxBytes,
  );

const formatUploadBytes = (bytes: number): string => {
  const safeBytes = Math.max(0, bytes);
  if (safeBytes < 1024) return `${safeBytes} B`;
  if (safeBytes < MIB) return `${Math.round(safeBytes / 1024)} KiB`;

  const mib = safeBytes / MIB;
  return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`;
};

const formatMiBWithDecimal = (bytes: number): string =>
  `${(Math.max(0, bytes) / MIB).toFixed(1)} MiB`;

const formatQuotaExceededMessage = (
  currentBytes: number,
  incomingBytes: number,
  maxBytes = MAX_REQUEST_UPLOAD_BYTES,
): string => {
  const decision = checkUploadAddition(currentBytes, incomingBytes, maxBytes);
  return `These files would use ${formatMiBWithDecimal(
    decision.nextBytes,
  )}. The combined limit is ${formatUploadBytes(
    maxBytes,
  )}, with ${formatMiBWithDecimal(decision.remainingBytes)} remaining.`;
};

const getUploadReadiness = (
  groups: readonly (readonly UploadFileLike[])[],
): UploadReadiness => {
  const files = groups.flat();
  if (files.some((upload) => Boolean(upload.error))) {
    return {
      ready: false,
      message: 'Remove or retry failed uploads before submitting.',
    };
  }
  if (files.some((upload) => upload.progress < 100)) {
    return {
      ready: false,
      message: 'Wait for all files to finish uploading before submitting.',
    };
  }
  if (files.some((upload) => !upload.url)) {
    return {
      ready: false,
      message: 'One or more completed uploads is missing its SharePoint link.',
    };
  }
  return { ready: true, message: null };
};

const assertUploadsReady = (
  groups: readonly (readonly UploadFileLike[])[],
): void => {
  const readiness = getUploadReadiness(groups);
  if (readiness.message) throw new Error(readiness.message);
};

export {
  assertUploadsReady,
  checkUploadAddition,
  checkUploadReplacement,
  formatQuotaExceededMessage,
  formatUploadBytes,
  getUploadReadiness,
  MAX_REQUEST_UPLOAD_BYTES,
  sumUploadBytes,
};
export type { UploadFileLike, UploadQuotaDecision, UploadReadiness };
