import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BrushCleaning,
  CalendarCheck,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FilterX,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InlineMessage } from '../components/ui';
import DeleteRequestModal from '../components/requests/DeleteRequestModal';
import type { DeleteRequestTarget } from '../components/requests/DeleteRequestModal';
import RequireRole from '../components/RequireRole';
import { useAuth } from '../context/AuthContext';
import { useRequests } from '../shared/hooks/useRequests';
import { getChoiceLabel, toSelectOptions } from '../data/types';
import {
  requestCategoryChoices,
  requestStatusChoices,
} from '../data/requestChoices';
import { matterChoices } from '../data/matterChoices';
import { DateField, SelectField, TextField } from '../forms';
import {
  filterRequestList,
  formatSubmissionDate,
  getSubmissionDateRangeError,
  parseRequestListState,
  serializeRequestListState,
} from '../shared/requestListState';
import type { RequestListState } from '../shared/requestListState';
import { getRequestRowPresentation } from '../shared/requestListPresentation';
import {
  canDeleteRequests,
  deleteRequestTree,
  RequestDeletionError,
} from '../shared/services/requestDeletionService';


const PAGE_SIZE = 10;
const SERVER_FETCH_SIZE = 100;

// Display-only overrides for a few status pills. The underlying Dataverse
// labels (FR / RS / R) still drive styling and the row action; only the text
// shown to the user is friendlier here.
const statusDisplayLabel: Record<string, string> = {
  FR: 'For Record',
  RS: 'Re-Submit',
  R: 'Booked',
};

// Filter copy only; option values remain the existing Dataverse status values.
const statusFilterLabel: Record<string, string> = {
  FR: 'For Record (FR)',
  R: 'Booked (R)',
  'Pending Ack': 'Pending Acknowledgement',
  ACK: 'Acknowledged (ACK)',
  'Pending Endorse': 'Pending Endorsement',
  E: 'Endorsed (E)',
  RS: 'Re-Submit (RS)',
  NC3: 'Non-compliant (NC3)',
  NC4: 'Non-compliant (NC4)',
  W: 'Waived (W)',
};

const statusFilterOptions = toSelectOptions(requestStatusChoices).map((option) => ({
  ...option,
  label: statusFilterLabel[option.label] ?? option.label,
}));

const statusClass: Record<string, string> = {
  New: 'status-new',
  Draft: 'status-new',
  'Checking details': 'status-new',
  'Unable to verify': 'status-rework',
  'Pending Review': 'status-review',
  'Draft Review': 'status-review',
  'Complete Review': 'status-review',
  'Under Verification': 'status-review',
  RS: 'status-rework',
  R: 'status-rework',
  ACK: 'status-completed',
  E: 'status-completed',
  FR: 'status-FR',
  'Ready for Eng': 'status-readyforEng',
};

// The row action button hints at what the request needs next, mirroring the
// status-driven actions on the detail page (New → Verify Data, Draft Review →
// Book Engagement). Every other status is a plain view. Button width is fixed
// in CSS so the varying labels stay visually equal.
const actionForStatus = (
  statusLabel: string,
): { label: string; Icon: LucideIcon } => {
  switch (statusLabel) {
    case 'New':
      return { label: 'Verify', Icon: ShieldCheck };
    case 'Draft Review':
      return { label: 'Review', Icon: CalendarCheck };
    default:
      return { label: 'View', Icon: ArrowUpRight };
  }
};

type MatterMeta = { label: string; code: string; channel: string };

export default function Requests() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const submittedId = searchParams.get('submitted');
  const [showSubmitted, setShowSubmitted] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteRequestTarget | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const {
    items,
    totalCount,
    isLoading,
    error,
    integrityById,
    integrityWarning,
    hasMore,
    loadMore,
    refetch,
  } = useRequests({
    pageSize: SERVER_FETCH_SIZE,
    withFormattedValues: true,
  });

  const matterMetaByValue = useMemo(() => {
    const m = new Map<number, MatterMeta>();
    matterChoices.forEach((c) =>
      m.set(c.value, { label: c.label, code: c.code, channel: c.channel })
    );
    return m;
  }, []);

  const listState = useMemo(
    () => parseRequestListState(searchParams),
    [searchParams],
  );
  const {
    matterTitle: matterTitleFilter,
    project: projectFilter,
    company: companyFilter,
    status: statusFilter,
    matterType: typeFilter,
    submittedFrom,
    submittedTo,
    page,
  } = listState;

  const updateListState = (
    updates: Partial<RequestListState>,
    resetPage = false,
  ) => {
    const nextState: RequestListState = {
      ...listState,
      ...updates,
      page: resetPage ? 1 : updates.page ?? listState.page,
    };
    setSearchParams(serializeRequestListState(nextState, submittedId), {
      replace: true,
    });
  };

  const hasActiveFilters =
    matterTitleFilter !== '' ||
    projectFilter !== '' ||
    companyFilter !== '' ||
    statusFilter !== '' ||
    typeFilter !== '' ||
    submittedFrom !== '' ||
    submittedTo !== '';

  const submissionDateRangeError = getSubmissionDateRangeError(listState);
  const canDelete = canDeleteRequests(user?.roles ?? []);

  const filtered = useMemo(
    () => filterRequestList(items, listState, matterMetaByValue),
    [items, listState, matterMetaByValue],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const clearFilters = () => {
    updateListState(
      {
        matterTitle: '',
        project: '',
        company: '',
        status: '',
        matterType: '',
        submittedFrom: '',
        submittedTo: '',
      },
      true,
    );
  };

  const openRecord = (id: string) => {
    navigate(`/requests/${id}`, {
      state: {
        requestsReturnTo: `${location.pathname}${location.search}`,
      },
    });
  };

  const openDeleteConfirmation = (target: DeleteRequestTarget) => {
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleteTarget(target);
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);
    const deletedRequestLabel = deleteTarget.request.title ?? deleteTarget.request.id;
    try {
      await deleteRequestTree(deleteTarget.request);
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof RequestDeletionError
          ? deleteFailure.message
          : 'The request could not be deleted. Please try again.',
      );
      setIsDeleting(false);
      return;
    }

    setDeleteTarget(null);
    setDeleteSuccess(`Request ${deletedRequestLabel} was deleted.`);
    setIsDeleting(false);
    await refetch();
  };

  return (
    <section className="rq-page">
      <div className="container">
        {/* Header — page title + filters */}
        <div className="rq-header">
          <div className="rq-header-top">
            <h1 className="rq-title">Requests</h1>
            <span className="rq-count-badge">
              <SlidersHorizontal size={14} aria-hidden="true" />
              {totalCount ?? items.length} total
              {filtered.length !== items.length && (
                <span className="rq-filtered-note">
                  &middot; {filtered.length} filtered
                </span>
              )}
            </span>
            <RequireRole roles={['Requestor']}>
              <button
                type="button"
                className="rq-create-btn"
                onClick={() => navigate('/submit')}
                title="Create a new request"
              >
                <Plus size={16} aria-hidden="true" />
                New Request
              </button>
            </RequireRole>
          </div>
          <p className="rq-subtitle">Review and track all submitted requests</p>

          {/* Filters */}
          {hasActiveFilters && (
            <div className="rq-filter-toolbar">
              <button
                type="button"
                className="rq-clear-btn"
                onClick={clearFilters}
              >
                <BrushCleaning size={16} aria-hidden="true" />
                Clear Filters
              </button>
            </div>
          )}
          <div className="rq-filters">
            <div className="rq-field">
              <TextField
                name="projectFilter"
                label="Project"
                value={projectFilter}
                onChange={(e) =>
                  updateListState({ project: e.target.value }, true)
                }
                placeholder="Search project…"
              />
            </div>
            <div className="rq-field">
              <TextField
                name="companyFilter"
                label="Company"
                value={companyFilter}
                onChange={(e) =>
                  updateListState({ company: e.target.value }, true)
                }
                placeholder="Search company…"
              />
            </div>
            <div className="rq-field">
              <TextField
                name="matterTitleFilter"
                label="Matter title"
                value={matterTitleFilter}
                onChange={(e) =>
                  updateListState({ matterTitle: e.target.value }, true)
                }
                placeholder="Search matter title…"
              />
            </div>
            <div className="rq-field">
              <SelectField
                name="statusFilter"
                label="Status"
                value={statusFilter || '__all__'}
                onChange={(e) =>
                  updateListState(
                    {
                      status:
                        e.target.value === '__all__' ? '' : e.target.value,
                    },
                    true,
                  )
                }
                options={[
                  { label: 'All statuses', value: '__all__' },
                  ...statusFilterOptions,
                ]}
              />
            </div>
            <div className="rq-field">
              <SelectField
                name="typeFilter"
                label="Matter type"
                value={typeFilter || '__all__'}
                onChange={(e) =>
                  updateListState(
                    {
                      matterType:
                        e.target.value === '__all__' ? '' : e.target.value,
                    },
                    true,
                  )
                }
                options={[
                  { label: 'All matter types', value: '__all__' },
                  ...matterChoices.map((m) => ({
                    label: m.label,
                    value: String(m.value),
                  })),
                ]}
              />
            </div>
            <div className="rq-field rq-date-filter">
              <div className="rq-date-filter-label">
                <CalendarRange size={14} aria-hidden="true" />
                Submission date
              </div>
              <div className="rq-date-range">
                <DateField
                  name="submittedFrom"
                  label="From"
                  value={submittedFrom}
                  aria-invalid={Boolean(submissionDateRangeError)}
                  aria-describedby={
                    submissionDateRangeError
                      ? 'rq-submission-date-error'
                      : undefined
                  }
                  onChange={(e) =>
                    updateListState({ submittedFrom: e.target.value }, true)
                  }
                />
                <DateField
                  name="submittedTo"
                  label="To"
                  value={submittedTo}
                  aria-invalid={Boolean(submissionDateRangeError)}
                  aria-describedby={
                    submissionDateRangeError
                      ? 'rq-submission-date-error'
                      : undefined
                  }
                  onChange={(e) =>
                    updateListState({ submittedTo: e.target.value }, true)
                  }
                />
              </div>
              {submissionDateRangeError ? (
                <div
                  id="rq-submission-date-error"
                  className="rq-date-error"
                  role="alert"
                >
                  {submissionDateRangeError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Submission confirmation */}
        {submittedId && showSubmitted && (
          <InlineMessage
            tone="success"
            className="mb-3"
            onDismiss={() => setShowSubmitted(false)}
          >
            Your request <strong>{submittedId}</strong> was submitted
            successfully and is now in the review queue.
          </InlineMessage>
        )}

        {deleteSuccess ? (
          <InlineMessage
            tone="success"
            className="mb-3"
            onDismiss={() => setDeleteSuccess(null)}
          >
            {deleteSuccess}
          </InlineMessage>
        ) : null}

        {/* Error */}
        {error && (
          <InlineMessage tone="error" title="Couldn’t load requests" className="mb-3">
            {error}
          </InlineMessage>
        )}

        {integrityWarning && !error ? (
          <InlineMessage
            tone="warning"
            title="Some request details could not be verified"
            className="mb-3"
          >
            {integrityWarning}
          </InlineMessage>
        ) : null}

        {/* Table */}
        <div className="rq-table-wrap">
          <table className="rq-table">
            <thead>
              <tr>
                <th className="col-req">Request no.</th>
                <th className="col-submission">Submission</th>
                <th className="col-matter">Matter type</th>
                <th className="col-requester">Requester</th>
                <th className="col-project">Project</th>
                <th className="col-company">Company</th>
                <th className="col-status">Status</th>
                <th className="col-action">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="rq-empty-state">
                    <Loader2 size={20} className="rq-spinner" aria-hidden="true" />
                    Loading requests…
                  </td>
                </tr>
              )}

              {!isLoading && filtered.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="rq-empty-state">
                    <FilterX size={20} aria-hidden="true" style={{ marginBottom: 4 }} />
                    <span>No requests match the current filters</span>
                  </td>
                </tr>
              )}

              {pageItems.map((r) => {
                const meta =
                  r.matter != null ? matterMetaByValue.get(r.matter) : undefined;
                const matterLabel = meta?.label ?? '\u2014';
                const matterTitle =
                  matterLabel.length > 28
                    ? `${matterLabel.slice(0, 28)}\u2026`
                    : matterLabel;
                const typeCode = meta?.code ?? null;
                const channel = meta?.channel ?? null;
                const categoryLabel =
                  r.category != null
                    ? getChoiceLabel(requestCategoryChoices, r.category) ?? null
                    : null;
                const statusLabel =
                  r.status != null
                    ? getChoiceLabel(requestStatusChoices, r.status) ?? '\u2014'
                    : '\u2014';
                const presentation = getRequestRowPresentation(
                  statusLabel,
                  integrityById.get(r.id),
                );
                const displayStatus =
                  presentation.actionMode === 'normal'
                    ? statusDisplayLabel[statusLabel] ?? statusLabel
                    : presentation.displayStatus;
                const statusCls = statusClass[presentation.displayStatus] ?? '';
                const action =
                  presentation.actionMode === 'edit'
                    ? { label: 'Edit', Icon: Pencil }
                    : presentation.actionMode === 'loading'
                      ? { label: 'Checking', Icon: Loader2 }
                      : presentation.actionMode === 'disabled'
                        ? { label: 'Unavailable', Icon: CircleAlert }
                        : actionForStatus(statusLabel);

                return (
                  <tr
                    key={r.id}
                    onClick={
                      presentation.isClickable
                        ? () => openRecord(r.id)
                        : undefined
                    }
                    onKeyDown={
                      presentation.isClickable
                        ? (event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openRecord(r.id);
                            }
                          }
                        : undefined
                    }
                    tabIndex={presentation.isClickable ? 0 : undefined}
                    className={
                      presentation.isClickable ? 'rq-row-clickable' : undefined
                    }
                  >
                    <td>
                      <span className="rq-req-id">{r.title ?? r.id.slice(0, 8)} {channel && (
                          <span className={`rq-chan-badge rq-cat-badge chan-${channel}`}>
                            {categoryLabel ?? channel.toUpperCase()}
                          </span>
                        )}</span>
                    </td>
                    <td>
                      <div className="cell-main">
                        {formatSubmissionDate(r.submittedOn)}
                      </div>
                    </td>
                    <td>
                      <div className="cell-main rq-matter-title" title={matterLabel}>
                        {matterTitle}
                      </div>
                      <div className="rq-badge-row">
                        {typeCode && (
                          <span className="rq-type-badge">{typeCode}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">{r.requestorName ?? '\u2014'}</div>
                      {r.requestorEmail && (
                        <div className="cell-sub">{r.requestorEmail}</div>
                      )}
                    </td>
                    <td>
                      <div className="cell-main">{r.projectName ?? '\u2014'}</div>
                    </td>
                    <td>
                      <div className="cell-main">{r.companyName ?? '\u2014'}</div>
                      {r.companyCode && (
                        <div className="cell-sub">{r.companyCode}</div>
                      )}
                    </td>
                    <td>
                      <span className={`rq-status-pill ${statusCls}`}>
                        <span className="rq-status-dot" />
                        {displayStatus}
                      </span>
                    </td>
                    <td>
                      <div className="rq-row-actions">
                        <button
                          type="button"
                          className="rq-open-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (presentation.actionMode === 'edit') {
                              navigate(`/requests/${r.id}/edit`);
                            } else if (presentation.actionMode === 'normal') {
                              openRecord(r.id);
                            }
                          }}
                          title={`${action.label} request`}
                          disabled={presentation.isDisabled}
                        >
                          {action.label}
                          <action.Icon
                            size={14}
                            aria-hidden="true"
                            className={
                              presentation.actionMode === 'loading'
                                ? 'rq-spinner'
                                : undefined
                            }
                          />
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className="rq-delete-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteConfirmation({
                                request: r,
                                matterLabel,
                              });
                            }}
                            aria-label={`Delete request ${r.title ?? r.id}`}
                            title="Delete request"
                            disabled={isDeleting}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="rq-pagination">
          <span className="rq-showing">
            {filtered.length === 0
              ? '0 results'
              : `Showing ${pageStart + 1} to ${Math.min(
                  pageStart + PAGE_SIZE,
                  filtered.length
                )} of ${filtered.length}`}
          </span>

          <div className="rq-pg-controls">
            <button
              type="button"
              className="rq-pg-btn"
              onClick={() =>
                updateListState({ page: Math.max(1, currentPage - 1) })
              }
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <span className="rq-pg-num">
              <strong>{currentPage}</strong> of {pageCount}
            </span>

            <button
              type="button"
              className="rq-pg-btn"
              onClick={() =>
                updateListState({ page: Math.min(pageCount, currentPage + 1) })
              }
              disabled={currentPage >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>

            {hasMore && (
              <button
                type="button"
                className="rq-load-more"
                onClick={() => void loadMore()}
                disabled={isLoading}
                title="Fetch more records from the server"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="rq-spinner" aria-hidden="true" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </div>
        </div>

        <DeleteRequestModal
          target={deleteTarget}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={closeDeleteConfirmation}
          onConfirm={() => void handleDeleteConfirm()}
        />
      </div>
    </section>
  );
}
