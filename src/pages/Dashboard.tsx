// src/pages/Dashboard.tsx
// Executive dashboard for Main Committee (and Admins).
// Shows KPI metric cards, charts, and quick-nav links per BRD §10.1.5.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  FolderOpen,
  Inbox,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { listRequests } from '../shared/services/requestService';
import { matterChoices } from '../data/matterChoices';

// Active statuses: New(1), Ready for Engagement(2), R(3), Draft Review(4),
// Pending Review(5), Complete Review(6), Pending Acceptance(7),
// Complete Acceptance(8), Pending Ack(9), Pending Endorse(11),
// Under Verification(14), Scheduled(15)
// Power Pages Web API does not support the OData `in` operator — use `or`.
const ACTIVE_FILTER =
  'gcp_requeststatus eq 1 or gcp_requeststatus eq 2 or gcp_requeststatus eq 3 or gcp_requeststatus eq 4 or gcp_requeststatus eq 5 or gcp_requeststatus eq 6 or gcp_requeststatus eq 7 or gcp_requeststatus eq 8 or gcp_requeststatus eq 9 or gcp_requeststatus eq 11 or gcp_requeststatus eq 14 or gcp_requeststatus eq 15';

// Closed/terminal: FR(0), ACK(10), E(12), Submitted(13), RS(16), NC3(17), NC4(18), W(19)
const CLOSED_FILTER =
  'gcp_requeststatus eq 0 or gcp_requeststatus eq 10 or gcp_requeststatus eq 12 or gcp_requeststatus eq 13 or gcp_requeststatus eq 16 or gcp_requeststatus eq 17 or gcp_requeststatus eq 18 or gcp_requeststatus eq 19';

const CHART_NAVY  = '#0b2545';
const CHART_BLUE  = '#3b82f6';
const CHART_GREEN = '#16a34a';
const CHART_AMBER = '#f59e0b';
const CATEGORY_COLORS = [CHART_BLUE, CHART_NAVY];
const STATUS_COLORS   = [CHART_AMBER, CHART_BLUE, CHART_GREEN];

type KpiState = {
  total: number | null;
  newRequests: number | null;
  active: number | null;
  closed: number | null;
};

type ChartData = {
  categorySlices: { name: string; value: number }[];
  matterBars: { name: string; count: number }[];
};

const fetchCount = async (filter?: string): Promise<number | null> => {
  try {
    const result = await listRequests({ pageSize: 1, filter, withFormattedValues: false });
    return result.totalCount ?? null;
  } catch {
    return null;
  }
};

export default function Dashboard() {
  const [kpi, setKpi] = useState<KpiState>({
    total: null,
    newRequests: null,
    active: null,
    closed: null,
  });
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchCount(),
      fetchCount('gcp_requeststatus eq 1'),
      fetchCount(ACTIVE_FILTER),
      fetchCount(CLOSED_FILTER),
    ]).then(([total, newReqs, active, closed]) => {
      if (cancelled) return;
      setKpi({ total, newRequests: newReqs, active, closed });
      setLoading(false);
    });

    Promise.all([
      fetchCount('gcp_category eq 1'),
      fetchCount('gcp_category eq 2'),
      ...matterChoices.map((m) => fetchCount(`gcp_mattertype eq ${m.value}`)),
    ]).then(([gcpCount, gcpcCount, ...matterCounts]) => {
      if (cancelled) return;
      setCharts({
        categorySlices: [
          { name: 'GCP', value: gcpCount ?? 0 },
          { name: 'GCPC', value: gcpcCount ?? 0 },
        ],
        matterBars: matterChoices
          .map((m, i) => ({ name: m.code, count: matterCounts[i] ?? 0 }))
          .sort((a, b) => b.count - a.count),
      });
      setChartsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number | null): string =>
    loading ? '—' : n != null ? String(n) : '—';

  const statusData = [
    { name: 'New', count: kpi.newRequests ?? 0 },
    {
      name: 'In Progress',
      count: Math.max(0, (kpi.active ?? 0) - (kpi.newRequests ?? 0)),
    },
    { name: 'Closed', count: kpi.closed ?? 0 },
  ];

  return (
    <section className="section">
      <div className="container">
        {/* Header */}
        <div className="rq-header">
          <div className="rq-header-top">
            <BarChart3 size={22} aria-hidden="true" />
            <h1 className="rq-title">Executive Dashboard</h1>
          </div>
          <p className="rq-subtitle">
            Read-only overview of all contract procurement requests and
            portfolio activity.
          </p>
        </div>

        {/* KPI cards */}
        <div className="dash-kpi-grid">
          <div className="dash-kpi-card">
            {loading ? (
              <Loader2 size={20} className="dash-kpi-spin" aria-hidden="true" />
            ) : (
              <span className="dash-kpi-value">{fmt(kpi.total)}</span>
            )}
            <span className="dash-kpi-label">Total Requests</span>
          </div>

          <div className="dash-kpi-card dash-kpi-card--new">
            {loading ? (
              <Loader2 size={20} className="dash-kpi-spin" aria-hidden="true" />
            ) : (
              <span className="dash-kpi-value">{fmt(kpi.newRequests)}</span>
            )}
            <span className="dash-kpi-label">New Requests</span>
          </div>

          <div className="dash-kpi-card dash-kpi-card--active">
            {loading ? (
              <Loader2 size={20} className="dash-kpi-spin" aria-hidden="true" />
            ) : (
              <span className="dash-kpi-value">{fmt(kpi.active)}</span>
            )}
            <span className="dash-kpi-label">In Progress</span>
          </div>

          <div className="dash-kpi-card dash-kpi-card--closed">
            {loading ? (
              <Loader2 size={20} className="dash-kpi-spin" aria-hidden="true" />
            ) : (
              <span className="dash-kpi-value">{fmt(kpi.closed)}</span>
            )}
            <span className="dash-kpi-label">Closed / Concluded</span>
          </div>
        </div>

        {/* Charts row: Donut + Status Bar */}
        <div className="dash-charts-grid">
          {/* Chart 1: GCP vs GCPC donut */}
          <div className="dash-chart-card">
            <h2 className="dash-chart-title">GCP vs GCPC</h2>
            {chartsLoading ? (
              <div className="dash-chart-loader">
                <Loader2 size={24} className="dash-kpi-spin" aria-hidden="true" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts?.categorySlices}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {charts?.categorySlices.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Requests']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 2: Pipeline status bar */}
          <div className="dash-chart-card">
            <h2 className="dash-chart-title">Pipeline Status</h2>
            {loading ? (
              <div className="dash-chart-loader">
                <Loader2 size={24} className="dash-kpi-spin" aria-hidden="true" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={statusData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    width={32}
                  />
                  <Tooltip formatter={(v) => [v, 'Requests']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {statusData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Requests by form type — horizontal bar */}
        <div className="dash-chart-card dash-chart-card--full">
          <h2 className="dash-chart-title">Requests by Form Type</h2>
          {chartsLoading ? (
            <div className="dash-chart-loader">
              <Loader2 size={24} className="dash-kpi-spin" aria-hidden="true" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={charts?.matterBars}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={56}
                />
                <Tooltip formatter={(v) => [v, 'Requests']} />
                <Bar
                  dataKey="count"
                  fill={CHART_NAVY}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Navigation cards */}
        <div className="dash-nav-grid">
          <Link to="/requests" className="dash-nav-card">
            <FileText size={28} aria-hidden="true" className="dash-nav-icon" />
            <div className="dash-nav-body">
              <h3 className="dash-nav-title">View Requests</h3>
              <p className="dash-nav-desc">
                Browse all GCP and GCPC request submissions. Filter by status,
                company, or matter type. Open any record for a full read-only
                view.
              </p>
            </div>
            <TrendingUp size={16} className="dash-nav-arrow" aria-hidden="true" />
          </Link>

          <Link to="/requests?channel=gcpc" className="dash-nav-card">
            <FolderOpen size={28} aria-hidden="true" className="dash-nav-icon" />
            <div className="dash-nav-body">
              <h3 className="dash-nav-title">GCPC Requests</h3>
              <p className="dash-nav-desc">
                View all GCPC-category requests including RTP, PBL, JVP, ST/SP,
                CAA, PCCA, PP, VAP, and Others.
              </p>
            </div>
            <TrendingUp size={16} className="dash-nav-arrow" aria-hidden="true" />
          </Link>

          <Link to="/requests?channel=gcp" className="dash-nav-card">
            <Inbox size={28} aria-hidden="true" className="dash-nav-icon" />
            <div className="dash-nav-body">
              <h3 className="dash-nav-title">GCP Requests</h3>
              <p className="dash-nav-desc">
                View all GCP-category requests including R-PCCA, CI, CPR, and
                Others.
              </p>
            </div>
            <TrendingUp size={16} className="dash-nav-arrow" aria-hidden="true" />
          </Link>
        </div>

        <p className="note">
          This is a read-only view. All data shown is sourced directly from
          Dataverse in real time.
        </p>
      </div>
    </section>
  );
}
