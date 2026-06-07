// src/forms/reviewComments.ts
// Block model + (de)serialization helpers for the reviewer-comment editor.
// The serialized JSON is persisted in the gcp_reviewercomments text column.
//
// v1 supports three block kinds: plain text, bulleted list, numbered list.
// (Images were intentionally deferred — no file-storage path is wired up yet.)

type ReviewTextBlock = { type: 'text'; text: string };
type ReviewBulletedListBlock = { type: 'bulleted-list'; items: string[] };
type ReviewNumberedListBlock = { type: 'numbered-list'; items: string[] };

type ReviewCommentBlock =
  | ReviewTextBlock
  | ReviewBulletedListBlock
  | ReviewNumberedListBlock;

type ReviewCommentBlockType = ReviewCommentBlock['type'];

type ReviewComments = {
  version: 1;
  blocks: ReviewCommentBlock[];
};

const CURRENT_VERSION = 1 as const;

/** Build an empty block of the given kind. */
const emptyBlock = (type: ReviewCommentBlockType): ReviewCommentBlock => {
  if (type === 'text') return { type: 'text', text: '' };
  return { type, items: [''] };
};

/** Type guard for a well-formed block coming off untrusted JSON. */
const isBlock = (value: unknown): value is ReviewCommentBlock => {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  if (b.type === 'text') return typeof b.text === 'string';
  if (b.type === 'bulleted-list' || b.type === 'numbered-list') {
    return Array.isArray(b.items) && b.items.every((i) => typeof i === 'string');
  }
  return false;
};

/**
 * Parse a stored gcp_reviewercomments value into editor blocks.
 * - Valid `{ version, blocks }` JSON → its blocks.
 * - A bare JSON array of blocks → those blocks.
 * - Anything else (legacy plain text / empty) → a single text block wrapping the
 *   raw string, so old data still renders and round-trips.
 */
const parseReviewComments = (raw: string | null | undefined): ReviewCommentBlock[] => {
  const value = (raw ?? '').trim();
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const blocks = Array.isArray(parsed)
      ? parsed
      : (parsed as { blocks?: unknown })?.blocks;
    if (Array.isArray(blocks)) {
      const valid = blocks.filter(isBlock);
      if (valid.length || blocks.length === 0) return valid;
    }
  } catch {
    // Not JSON — fall through to the legacy-text wrapper.
  }
  return [{ type: 'text', text: value }];
};

/** Drop empty text blocks and blank list items before persisting. */
const normalizeBlocks = (blocks: ReviewCommentBlock[]): ReviewCommentBlock[] =>
  blocks
    .map((b): ReviewCommentBlock =>
      b.type === 'text'
        ? { type: 'text', text: b.text.trim() }
        : { type: b.type, items: b.items.map((i) => i.trim()).filter(Boolean) },
    )
    .filter((b) => (b.type === 'text' ? b.text.length > 0 : b.items.length > 0));

/** Serialize editor blocks to the JSON string stored in gcp_reviewercomments. */
const serializeReviewComments = (blocks: ReviewCommentBlock[]): string => {
  const clean = normalizeBlocks(blocks);
  if (clean.length === 0) return '';
  const payload: ReviewComments = { version: CURRENT_VERSION, blocks: clean };
  return JSON.stringify(payload);
};

export { emptyBlock, parseReviewComments, normalizeBlocks, serializeReviewComments };
export type {
  ReviewComments,
  ReviewCommentBlock,
  ReviewCommentBlockType,
  ReviewTextBlock,
  ReviewBulletedListBlock,
  ReviewNumberedListBlock,
};
