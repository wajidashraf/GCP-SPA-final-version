const MARKER_V2 = '\n\nGCP_LETTER_METADATA_V2:';
const LEGACY_MARKER = '\n\n<!--GCP_LETTER:';
const LEGACY_MARKER_END = '-->';

export interface StoredLetter {
  templateKey: string;
  values: Record<string, string>;
}

const parsePayload = (raw: string): StoredLetter | null => {
  try {
    const parsed = JSON.parse(raw) as StoredLetter;
    if (parsed && typeof parsed.templateKey === 'string') {
      return { templateKey: parsed.templateKey, values: parsed.values ?? {} };
    }
  } catch {
    /* fall through */
  }
  return null;
};

/** Pull saved manual values out of a stored letter field. */
export const parseStoredLetter = (
  raw: string | null | undefined,
): StoredLetter | null => {
  if (!raw) return null;

  const v2Start = raw.lastIndexOf(MARKER_V2);
  if (v2Start !== -1) {
    const parsed = parsePayload(raw.slice(v2Start + MARKER_V2.length));
    if (parsed) return parsed;
  }

  const legacyStart = raw.indexOf(LEGACY_MARKER);
  if (legacyStart === -1) return null;
  const jsonStart = legacyStart + LEGACY_MARKER.length;
  const legacyEnd = raw.indexOf(LEGACY_MARKER_END, jsonStart);
  if (legacyEnd === -1) return null;
  return parsePayload(raw.slice(jsonStart, legacyEnd));
};

/** Append re-editable metadata without HTML syntax that can trigger the WAF. */
export const serializeStoredLetter = (
  letterText: string,
  payload: StoredLetter,
): string => `${letterText}${MARKER_V2}${JSON.stringify(payload)}`;
