import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BrushCleaning, CalendarCheck, ShieldCheck, SlidersHorizontal, ChevronLeft, ChevronRight, FilterX, Loader2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InlineMessage } from '../components/ui';
import RequireRole from '../components/RequireRole';
import { useRequests } from '../shared/hooks/useRequests';
import { getChoiceLabel, toSelectOptions } from '../data/types';
import {
  requestCategoryChoices,
  requestStatusChoices,
} from '../data/requestChoices';
import { matterChoices } from '../data/matterChoices';
import { soaCodeChoices } from '../data/soaChoices';
import { SelectField, TextField } from '../forms';


const PAGE_SIZE = 10;
const SERVER_FETCH_SIZE = 100;

const statusClass: Record<string, string> = {
  New: 'status-new',
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
  const [searchParams] = useSearchParams();
  const submittedId = searchParams.get('submitted');
  const [showSubmitted, setShowSubmitted] = useState(true);
  const { items, totalCount, isLoading, error, hasMore, loadMore } = useRequests({
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

  // Filter state
  const [projectFilter, setProjectFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [soaFilter, setSoaFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const hasActiveFilters =
    projectFilter !== '' ||
    companyFilter !== '' ||
    statusFilter !== '' ||
    typeFilter !== '' ||
    soaFilter !== '';

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [projectFilter, companyFilter, statusFilter, typeFilter, soaFilter]);

  const filtered = useMemo(() => {
    const p = projectFilter.trim().toLowerCase();
    const c = companyFilter.trim().toLowerCase();
    const s = statusFilter ? Number(statusFilter) : null;
    const t = typeFilter ? Number(typeFilter) : null;
    const soa = soaFilter ? Number(soaFilter) : null;

    return items.filter((r) => {
      if (p) {
        const projectName = (r.projectName ?? '').toLowerCase();
        if (!projectName.includes(p)) return false;
      }
      if (c) {
        const company = `${r.companyName ?? ''} ${r.companyCode ?? ''}`.toLowerCase();
        if (!company.includes(c)) return false;
      }
      if (s != null && r.status !== s) return false;
      if (t != null && r.matter !== t) return false;
      if (soa != null && r.soaCode !== soa) return false;
      return true;
    });
  }, [items, projectFilter, companyFilter, statusFilter, typeFilter, soaFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const clearFilters = () => {
    setProjectFilter('');
    setCompanyFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setSoaFilter('');
  };

  const openRecord = (id: string) => {
    navigate(`/requests/${id}`);
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
          <div className="rq-filters">
            <div className="rq-field">
            <TextField
              name="projectFilter"
              label="Project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Search project..."
            />
          </div>
          <div className="rq-field">
            <TextField
              name="companyFilter"
              label="Company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              placeholder="Search company..."
            />
          </div>
          <div className="rq-field">
            <SelectField
              name="statusFilter"
              label="Status"
              value={statusFilter || '__all__'}
              onChange={(e) =>
                setStatusFilter(e.target.value === '__all__' ? '' : e.target.value)
              }
              options={[
                { label: 'All statuses', value: '__all__' },
                ...toSelectOptions(requestStatusChoices),
              ]}
            />
          </div>
          <div className="rq-field">
            <SelectField
              name="typeFilter"
              label="Matter type"
              value={typeFilter || '__all__'}
              onChange={(e) =>
                setTypeFilter(e.target.value === '__all__' ? '' : e.target.value)
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
          <div className="rq-field">
            <SelectField
              name="soaFilter"
              label="SOA code"
              value={soaFilter || '__all__'}
              onChange={(e) =>
                setSoaFilter(e.target.value === '__all__' ? '' : e.target.value)
              }
              options={[
                { label: 'All SOA codes', value: '__all__' },
                ...soaCodeChoices.map((s) => ({
                  label: s.label,
                  value: String(s.value),
                })),
              ]}
            />
          </div>

            {hasActiveFilters && (
              <div className="rq-clear-wrap">
                <button
                  type="button"
                  className="rq-clear-btn mb-3"
                  onClick={clearFilters}
                  aria-label="Clear filters"
                  title="Clear filters"
                >
                  <BrushCleaning size={16} aria-hidden="true" />
                </button>
              </div>
            )}
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

        {/* Error */}
        {error && (
          <InlineMessage tone="error" title="Couldn’t load requests" className="mb-3">
            {error}
          </InlineMessage>
        )}

        {/* Table */}
        <div className="rq-table-wrap">
          <table className="rq-table">
            <thead>
              <tr>
                <th className="col-req">Request no.</th>
                <th className="col-matter">Matter type</th>
                <th className="col-requester">Requester</th>
                <th className="col-project">Project</th>
                <th className="col-company">Company</th>
                <th className="col-status">Status</th>
                <th className="col-action" />
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="rq-empty-state">
                    <Loader2 size={20} className="rq-spinner" aria-hidden="true" />
                    Loading requests...
                  </td>
                </tr>
              )}

              {!isLoading && filtered.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="rq-empty-state">
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
                const soaLabel =
                  r.soaCode != null
                    ? getChoiceLabel(soaCodeChoices, r.soaCode) ?? null
                    : null;
                const categoryLabel =
                  r.category != null
                    ? getChoiceLabel(requestCategoryChoices, r.category) ?? null
                    : null;
                const statusLabel =
                  r.status != null
                    ? getChoiceLabel(requestStatusChoices, r.status) ?? '\u2014'
                    : '\u2014';
                const statusCls = statusClass[statusLabel] ?? '';
                const action = actionForStatus(statusLabel);

                return (
                  <tr key={r.id} onClick={() => openRecord(r.id)} className="rq-row-clickable">
                    <td>
                      <span className="rq-req-id">{r.title ?? r.id.slice(0, 8)} {channel && (
                          <span className={`rq-chan-badge rq-cat-badge chan-${channel}`}>
                            {categoryLabel ?? channel.toUpperCase()}
                          </span>
                        )}</span>
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
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="rq-open-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecord(r.id);
                        }}
                        title={`${action.label} request`}
                      >
                        {action.label}
                        <action.Icon size={14} aria-hidden="true" />
                      </button>
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}