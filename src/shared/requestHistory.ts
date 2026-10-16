import type { GcpRequest } from '../types/request';
import type { GcpSignature } from './services/signatureService';

type AcceptanceSource = Partial<Pick<GcpRequest,
  'acceptanceDate' | 'reviewCode1a' | 'reviewCode1b' | 'reviewCode2' |
  'reviewCode3' | 'reviewCode1bComment'
>>;

type AcceptanceHistory = {
  date: string | null;
  conclusionCodes: string[];
  legacyComment: string | null;
};

type RequestSignatureEvent = {
  signature: GcpSignature & { signUrl: string };
  kind: 'hoc' | 'signatory';
  identity: string;
};

/** Stored facts only: the original declaration/actor/signature snapshot is absent. */
export const getAcceptanceHistory = (request: AcceptanceSource): AcceptanceHistory | null => {
  const conclusionCodes: string[] = [];
  if (request.reviewCode1a === true) conclusionCodes.push('1(a)');
  if (request.reviewCode1b === true) conclusionCodes.push('1(b)');
  if (request.reviewCode2 === true) conclusionCodes.push('2');
  if (request.reviewCode3 === true) conclusionCodes.push('3');
  const date = request.acceptanceDate?.trim() ? request.acceptanceDate : null;
  const legacyComment = request.reviewCode1bComment?.trim() ? request.reviewCode1bComment : null;
  if (!date && conclusionCodes.length === 0 && !legacyComment) return null;
  return { date, conclusionCodes, legacyComment };
};

/** Iterate saved events, never today's signatory roster or reusable previews. */
export const getRequestSignatureEvents = (
  requestId: string,
  signatures: readonly GcpSignature[],
): RequestSignatureEvent[] => signatures.flatMap((signature) => {
  if (signature.requestId?.toLowerCase() !== requestId.toLowerCase() ||
      !signature.signUrl?.trim()) return [];
  const kind = signature.signatoryEmail?.trim().toLowerCase() === 'hoc' ? 'hoc' : 'signatory';
  const identity = signature.signatoryName?.trim() ||
    (kind === 'signatory' ? signature.signatoryEmail?.trim() : null) ||
    signature.signatoryContactId || 'Signer not recorded';
  return [{ signature: { ...signature, signUrl: signature.signUrl }, kind, identity }];
});

/** Follow only the current portal's Web API; never forward its token elsewhere. */
export const normalizeRequestNextLink = (
  link: string,
  origin: string = window.location.origin,
): string => {
  const url = new URL(link, origin);
  if (url.origin !== new URL(origin).origin || !url.pathname.startsWith('/_api/') ||
      url.username || url.password || url.hash) {
    throw new Error('Pagination requires a same-origin Power Pages Web API URL.');
  }
  return `${url.pathname}${url.search}`;
};

/** Collect the typed service pages, including grandchildren such as bidders. */
export const collectRequestPages = async <T>(
  loadPage: (nextLink?: string) => Promise<{ items: T[]; nextLink?: string }>,
  origin?: string,
): Promise<T[]> => {
  const items: T[] = [];
  const seen = new Set<string>();
  let nextLink: string | undefined;
  do {
    const page = await loadPage(nextLink);
    items.push(...page.items);
    nextLink = page.nextLink ? normalizeRequestNextLink(page.nextLink, origin) : undefined;
    if (nextLink) {
      if (seen.has(nextLink)) throw new Error('Pagination returned a repeated continuation URL. Retry loading the request.');
      seen.add(nextLink);
    }
  } while (nextLink);
  return items;
};

export type { AcceptanceHistory, RequestSignatureEvent };
