export interface RequestListFilters {
  matterTitle: string;
  project: string;
  company: string;
  status: string;
  matterType: string;
  submittedFrom: string;
  submittedTo: string;
}

export interface RequestListState extends RequestListFilters {
  page: number;
}

export interface RequestMatterMeta {
  label: string;
  code: string;
}

export interface FilterableRequest {
  projectName: string | null;
  companyName: string | null;
  companyCode: string | null;
  status: number | null;
  matter: number | null;
  submittedOn: string | null;
}

const DEFAULT_PAGE = 1;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalize = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const normalizeDateInput = (value: string | null | undefined): string => {
  const candidate = (value ?? '').trim();
  if (!DATE_INPUT_PATTERN.test(candidate)) return '';

  const date = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === candidate
    ? candidate
    : '';
};

const malaysiaDateKey = (value: string | null | undefined): string => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
};

const parsePage = (value: string | null): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
};

export const parseRequestListState = (
  params: URLSearchParams,
): RequestListState => ({
  matterTitle: params.get('matterTitle') ?? '',
  project: params.get('project') ?? '',
  company: params.get('company') ?? '',
  status: params.get('status') ?? '',
  matterType: params.get('type') ?? '',
  submittedFrom: normalizeDateInput(params.get('submittedFrom')),
  submittedTo: normalizeDateInput(params.get('submittedTo')),
  page: parsePage(params.get('page')),
});

export const serializeRequestListState = (
  state: RequestListState,
  submittedId?: string | null,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (state.matterTitle) params.set('matterTitle', state.matterTitle);
  if (state.project) params.set('project', state.project);
  if (state.company) params.set('company', state.company);
  if (state.status) params.set('status', state.status);
  if (state.matterType) params.set('type', state.matterType);
  if (state.submittedFrom) params.set('submittedFrom', state.submittedFrom);
  if (state.submittedTo) params.set('submittedTo', state.submittedTo);
  if (state.page > DEFAULT_PAGE) params.set('page', String(state.page));
  if (submittedId) params.set('submitted', submittedId);

  return params;
};

export const getSubmissionDateRangeError = (
  filters: Pick<RequestListFilters, 'submittedFrom' | 'submittedTo'>,
): string | null => {
  const from = normalizeDateInput(filters.submittedFrom);
  const to = normalizeDateInput(filters.submittedTo);

  return from && to && from > to
    ? 'From date must be on or before To date.'
    : null;
};

export const filterRequestList = <T extends FilterableRequest>(
  items: readonly T[],
  filters: RequestListFilters,
  matterMetaByValue: ReadonlyMap<number, RequestMatterMeta>,
): T[] => {
  const matterTitle = normalize(filters.matterTitle);
  const project = normalize(filters.project);
  const company = normalize(filters.company);
  const status = filters.status ? Number(filters.status) : null;
  const matterType = filters.matterType ? Number(filters.matterType) : null;
  const dateRangeError = getSubmissionDateRangeError(filters);
  const submittedFrom = dateRangeError
    ? ''
    : normalizeDateInput(filters.submittedFrom);
  const submittedTo = dateRangeError ? '' : normalizeDateInput(filters.submittedTo);

  return items.filter((request) => {
    if (matterTitle) {
      const matterMeta =
        request.matter == null ? undefined : matterMetaByValue.get(request.matter);
      const searchableMatter = normalize(
        `${matterMeta?.label ?? ''} ${matterMeta?.code ?? ''}`,
      );
      if (!searchableMatter.includes(matterTitle)) return false;
    }

    if (project && !normalize(request.projectName).includes(project)) return false;

    if (company) {
      const searchableCompany = normalize(
        `${request.companyName ?? ''} ${request.companyCode ?? ''}`,
      );
      if (!searchableCompany.includes(company)) return false;
    }

    if (status != null && request.status !== status) return false;
    if (matterType != null && request.matter !== matterType) return false;

    if (submittedFrom || submittedTo) {
      const submittedDate = malaysiaDateKey(request.submittedOn);
      if (!submittedDate) return false;
      if (submittedFrom && submittedDate < submittedFrom) return false;
      if (submittedTo && submittedDate > submittedTo) return false;
    }

    return true;
  });
};

const submissionDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kuala_Lumpur',
});

export const formatSubmissionDate = (value: string | null | undefined): string => {
  if (!value) return '\u2014';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '\u2014' : submissionDateFormatter.format(date);
};

export const getRequestsReturnPath = (locationState: unknown): string => {
  if (!locationState || typeof locationState !== 'object') return '/requests';

  const returnTo = (locationState as { requestsReturnTo?: unknown }).requestsReturnTo;
  if (
    typeof returnTo === 'string' &&
    (returnTo === '/requests' || returnTo.startsWith('/requests?'))
  ) {
    return returnTo;
  }

  return '/requests';
};
