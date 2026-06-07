import { useMemo, useState } from "react";
import { Building2, Landmark } from "lucide-react";
import RequestTypeCard from "../components/RequestTypeCard";
import { matterChoices } from "../data/matterChoices";

type Channel = "gcpc" | "gcp";

const tabs = [
  { id: "gcpc" as Channel, label: "GCPC", Icon: Building2 },
  { id: "gcp" as Channel, label: "GCP", Icon: Landmark },
];

export default function Submit() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Channel>("gcpc");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (label: string, code: string) =>
      !q || label.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    return matterChoices.filter(
      (m) => m.channel === activeTab && match(m.label, m.code),
    );
  }, [query, activeTab]);

  return (
    <section className="section">
      <div className="container">
        <div className="rd-hero mb-4">
          <div className="rd-hero-main">
            <div className="rd-hero-eyebrow">
              <Building2 size={16} aria-hidden="true" />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
                New Request
              </span>
            </div>
            <h1 className="rd-hero-title">Create a Request</h1>
            <p style={{ margin: '6px 0 0', opacity: 0.75, fontSize: '0.9rem' }}>
              Select the request type to begin.
            </p>
          </div>

          <div style={{ minWidth: 260, maxWidth: 380, flex: '1 1 260px' }}>
            <input
              type="search"
              className="form-control"
              placeholder="Search by keyword or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search request types"
              style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.6)', color: '#1a1a2e' }}
            />
          </div>
        </div>

        <div
          className="channel-tabs"
          role="tablist"
          aria-label="Request category"
        >
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`panel-${id}`}
              className={`channel-tab ${id} ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label} Requests</span>
            </button>
          ))}
        </div>

        <div
          className="request-section"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <div className="request-grid two-col">
            {items.length === 0 ? (
              <p className="empty">No matches.</p>
            ) : (
              items.map((m) => (
                <RequestTypeCard
                  key={m.value}
                  label={m.label}
                  code={m.code}
                  channel={activeTab}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
