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

/** Read the persisted body without regenerating it from a current template. */
export const extractStoredLetterText = (raw: string | null | undefined): string => {
  if (!raw) return '';

  // Historical display must not drop ordinary body text that happens to contain
  // a marker. Only a complete, well-formed metadata suffix is removable.
  const isMetadata = (value: string): boolean => {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      const { templateKey, values } = parsed as Record<string, unknown>;
      return typeof templateKey === 'string' && templateKey.length > 0 &&
        values !== null && typeof values === 'object' && !Array.isArray(values) &&
        Object.values(values).every((item) => typeof item === 'string');
    } catch {
      return false;
    }
  };

  const v2Start = raw.lastIndexOf(MARKER_V2);
  if (v2Start !== -1 && isMetadata(raw.slice(v2Start + MARKER_V2.length))) {
    return raw.slice(0, v2Start);
  }

  const legacyStart = raw.lastIndexOf(LEGACY_MARKER);
  const trimmedEnd = raw.trimEnd();
  if (legacyStart !== -1 && trimmedEnd.endsWith(LEGACY_MARKER_END)) {
    const payload = trimmedEnd.slice(
      legacyStart + LEGACY_MARKER.length,
      -LEGACY_MARKER_END.length,
    );
    if (isMetadata(payload)) return raw.slice(0, legacyStart);
  }
  return raw;
};
