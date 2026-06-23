import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Info,
  Layers3,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Send,
  ShieldCheck,
  Tag,
  User,
} from "lucide-react";
import { InlineMessage, LoadingState } from "../components/ui";
import {
  BiddersTable,
  DetailSection,
  DocumentStrip,
  DocumentsSection,
  buildFields,
  caaSections,
  ciSections,
  cprSections,
  fieldLabel,
  jvpSections,
  otherSections,
  pblSections,
  pccaSections,
  rpccaSections,
  rtpSections,
  stspSections,
} from "../components/detail";
import type { FieldDef, RenderedField, SectionDef } from "../components/detail";
import { useRequestDetail } from "../shared/hooks/useRequestDetail";
import type { ChildData } from "../shared/hooks/useRequestDetail";
import { groupDocuments, parseDocuments } from "../shared/documents";
import { getVerifierInfo } from "../shared/services/requestService";
import type { VerifierInfo } from "../shared/services/requestService";
import { listSuggestionsForRequest } from "../shared/services/suggestionService";
import type { GcpSuggestion } from "../shared/services/suggestionService";
import { getChoiceLabel } from "../data/types";
import {
  decisionCodeChoices,
  decisionCodeDescriptions,
  registrationTypeChoices,
  requestCategoryChoices,
  requestStatusChoices,
} from "../data/requestChoices";
import { parseReviewComments } from "../forms";
import type { ReviewCommentBlock } from "../forms";
import { matterChoices } from "../data/matterChoices";
import { soaCodeChoices } from "../data/soaChoices";
import type { GcpRequest } from "../types/request";
import type { GcpRtpRequest } from "../types/rtpRequest";
import { useAuth } from "../context/AuthContext";
import { isAdmin, hasRole } from "../utils/authorization";
import { hasEditForm } from "../forms/editRegistry";
import { AddSuggestionModal } from "../components/suggestions/AddSuggestionModal";
import { SuggestionsViewModal } from "../components/suggestions/SuggestionsViewModal";
import { SignatureSection } from "../components/signatures";

const statusClass: Record<string, string> = {
  New: "status-new",
  "Pending Review": "status-review",
  "Draft Review": "status-review",
  "Complete Review": "status-review",
  "Under Verification": "status-review",
  RS: "status-rework",
  R: "status-rework",
  ACK: "status-completed",
  E: "status-completed",
  FR: "status-FR",
  "Ready for Engagement": "status-readyforEng",
};

// Matter codes whose Basic Information project field keeps the "Project Name"
// label. Every other matter type relabels the same value as "Contract".
const PROJECT_NAME_CODES = new Set(["RTP", "PBL", "JVP", "ST/SP", "CAA"]);

// Labels shown in Section 1 (Basic Information). Any child/parent field carrying
// one of these labels is dropped from Section 2 to avoid duplicate data. Both
// "Project Name" and "Contract" are listed since the project field is relabelled
// conditionally — whichever is used, it stays unique to Section 1.
const BASIC_INFO_LABELS = new Set([
  "Matter Title",
  "Project Name",
  "Contract",
  "Requestor",
  "Requestor Email",
  "Company",
  "Project Code",
  "Submitted On",
]);

// RTP requests show a focused Detail Information section: only the four
// registration fields below (overriding the full flattened RTP section grids).
const rtpDetailFields: FieldDef<GcpRtpRequest>[] = [
  { label: "Client Name", get: (r) => r.clientNameText },
  {
    label: "Registration Type",
    kind: "choice",
    choices: registrationTypeChoices,
    get: (r) => r.registrationType,
  },
  {
    label: "Tender Closing Date",
    kind: "date",
    get: (r) => r.tenderClosingDate,
  },
  { label: "Special Project", kind: "boolean", get: (r) => r.specialProject },
];

// Parent (gcp_request) fields that belong in Section 2 (Detail Information).
// Only fields actually persisted on submit (see mapping.md) are shown —
// acknowledgement (gcp_acknowledgement) is the only parent detail captured by
// every form. Project description, confidential and notes are not mapped on
// submission, so they're intentionally omitted.
const parentDetailFields: SectionDef<GcpRequest>["fields"] = [
  { label: "Acknowledged", kind: "boolean", get: (r) => r.acknowledged },
];

/** Flatten a loaded child record's section grids into a single field list. */
const flattenChildFields = (child: ChildData): RenderedField[] => {
  if (child.type === "unsupported" || child.records.length === 0) return [];

  const fields: RenderedField[] = [];
  switch (child.type) {
    case "rtp":
      child.records.forEach((rec) =>
        rtpSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "pbl":
      child.records.forEach((rec) =>
        pblSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "jvp":
      child.records.forEach((rec) =>
        jvpSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "stsp":
      child.records.forEach((rec) =>
        stspSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "caa":
      child.records.forEach((rec) =>
        caaSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "pcca":
      child.records.forEach((rec) =>
        pccaSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "other":
      child.records.forEach((rec) =>
        otherSections.forEach((s) =>
          fields.push(...buildFields(s.fields, rec)),
        ),
      );
      break;
    case "rpcca":
      child.records.forEach((rec) =>
        rpccaSections.forEach((s) =>
          fields.push(...buildFields(s.fields, rec)),
        ),
      );
      break;
    case "ci":
      child.records.forEach((rec) =>
        ciSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    case "cpr":
      child.records.forEach((rec) =>
        cprSections.forEach((s) => fields.push(...buildFields(s.fields, rec))),
      );
      break;
    // pp / vap / rpp children carry no detail beyond Basic Information + the
    // parent's Acknowledged field, so they intentionally contribute no fields.
  }
  return fields;
};

/**
 * Merge parent + child fields into a single ordered list for Section 2,
 * dropping anything shown in Section 1 and any repeated label.
 */
const buildDetailFields = (
  request: GcpRequest,
  child: ChildData | null,
): RenderedField[] => {
  let groups: RenderedField[][];
  if (child?.type === "rtp") {
    // RTP: show only the four registration fields, not the parent leftovers.
    groups = child.records.map((rec) => buildFields(rtpDetailFields, rec));
  } else {
    groups = [buildFields(parentDetailFields, request)];
    if (child) groups.push(flattenChildFields(child));
  }

  const seen = new Set<string>();
  const out: RenderedField[] = [];
  for (const group of groups) {
    for (const field of group) {
      if (BASIC_INFO_LABELS.has(field.label) || seen.has(field.label)) continue;
      seen.add(field.label);
      out.push(field);
    }
  }
  return out;
};

/** Note shown inside Section 2 when no structured child detail is available. */
const childDetailNote = (child: ChildData | null): ReactNode => {
  if (!child) return null;
  if (child.type === "unsupported") {
    return (
      <InlineMessage tone="info" title="Detailed view not available">
        A structured breakdown for <strong>{child.code ?? "this"}</strong>{" "}
        requests isn’t available in this view yet.
      </InlineMessage>
    );
  }
  if (child.records.length === 0) {
    return (
      <InlineMessage tone="info" title="No detail record found">
        This request has no associated detail record, or it isn’t accessible
        with your current permissions.
      </InlineMessage>
    );
  }
  return null;
};

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, child, isLoading, error, childError, refetch } =
    useRequestDetail(id);
  const { user, isLoading: authLoading } = useAuth();

  // ── Record-level access ──────────────────────────────────────────────────
  // Client-side UX guard (the authoritative boundary is the gcp_request table
  // permissions). A user may view this request if they are an Administrator, a
  // reviewing role (Reviewer / Verifier / Working GCPC / Endorser / Main
  // Committee), the HOC of the request's company, or the requestor themselves.
  // Anyone else who lands here (e.g. a Requestor opening another Requestor's
  // record) is shown a message and redirected back to the requests list.
  const accessDenied = useMemo(() => {
    if (!request || authLoading) return false;
    const elevated =
      isAdmin() ||
      hasRole("Reviewer") ||
      hasRole("Verifier") ||
      hasRole("Working GCPC") ||
      hasRole("Endorser") ||
      hasRole("Main Committee");
    if (elevated) return false;
    const isOwner =
      !!user?.contactId && request.requestorContactId === user.contactId;
    if (isOwner) return false;
    const isHocForCompany =
      hasRole("HOC") &&
      !!user?.companyAccountId &&
      request.companyId === user.companyAccountId;
    if (isHocForCompany) return false;
    return true;
  }, [request, authLoading, user]);

  useEffect(() => {
    if (!accessDenied) return;
    const t = setTimeout(() => navigate("/requests", { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [accessDenied, navigate]);

  // ── Suggestion state ─────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<GcpSuggestion[]>([]);
  const [showAddSuggestion, setShowAddSuggestion] = useState(false);
  const [showViewSuggestions, setShowViewSuggestions] = useState(false);

  const isDraftReview = request?.status === 4;
  const isPendingReview = request?.status === 5;
  const isCompleteReview = request?.status === 6;
  // 8 = legacy Complete Acceptance; 9 = Pending Ack (GCP); 11 = Pending Endorse (GCPC)
  const isCompleteAcceptance =
    request?.status === 8 || request?.status === 9 || request?.status === 11;
  const canAddSuggestion = isDraftReview && hasRole("Working GCPC");

  const loadSuggestions = useCallback(async () => {
    if (!id || !isDraftReview) {
      setSuggestions([]);
      return;
    }
    try {
      const items = await listSuggestionsForRequest(id);
      setSuggestions(items);
    } catch {
      setSuggestions([]);
    }
  }, [id, isDraftReview]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const meta = useMemo(() => {
    if (!request) return null;
    const matter = matterChoices.find((m) => m.value === request.matter);
    const categoryLabel =
      request.category != null
        ? getChoiceLabel(requestCategoryChoices, request.category)
        : null;
    const soaLabel =
      request.soaCode != null
        ? getChoiceLabel(soaCodeChoices, request.soaCode)
        : null;
    const statusLabel =
      request.status != null
        ? (getChoiceLabel(requestStatusChoices, request.status) ?? null)
        : null;
    return {
      matterLabel: matter?.label ?? "Request",
      matterCode: matter?.code ?? null,
      channel: matter?.channel ?? null,
      categoryLabel,
      soaLabel,
      statusLabel,
      statusCls: statusLabel ? (statusClass[statusLabel] ?? "status-new") : "",
    };
  }, [request]);

  // Edit gate — show the Edit button only when the request is in RS (16), the
  // viewer may edit (owner / Reviewer / Verifier / admin), and an edit form is
  // registered for this matter type. Authoritative checks are the table
  // permissions + the EditRequest page's own guards; this is UX only.
  const canEdit = useMemo(() => {
    if (!request || authLoading) return false;
    if (request.status !== 16) return false;
    if (!hasEditForm(meta?.matterCode)) return false;
    const isOwner =
      !!user?.contactId && request.requestorContactId === user.contactId;
    return (
      isOwner || isAdmin() || hasRole("Reviewer") || hasRole("Verifier")
    );
  }, [request, authLoading, user, meta]);

  // Section 1 fields — the project field is relabelled "Contract" for matter
  // types outside the registration/proposal flows; the value is unchanged.
  const basicInfoFields = useMemo<SectionDef<GcpRequest>["fields"]>(() => {
    const projectLabel = PROJECT_NAME_CODES.has(meta?.matterCode ?? "")
      ? "Project Name"
      : "Contract";
    return [
      { label: "Matter Title", get: () => meta?.matterLabel ?? null },
      { label: projectLabel, get: (r) => r.projectName },
      { label: "Requestor", get: (r) => r.requestorName },
      { label: "Requestor Email", get: (r) => r.requestorEmail },
      { label: "Company", get: (r) => r.companyName },
      { label: "Project Code", get: (r) => r.projectCode },
      { label: "Submitted On", kind: "datetime", get: (r) => r.submittedOn },
    ];
  }, [meta]);

  // Section 2 fields — parent + child detail, de-duplicated against Section 1.
  const detailFields = useMemo(
    () => (request ? buildDetailFields(request, child) : []),
    [request, child],
  );

  // Documents stored on gcp_request.gcp_documentsurl, split into request-level
  // links (field: null) and per-field groups keyed by the form field they were
  // uploaded against.
  const { requestDocs, fieldDocGroups } = useMemo(() => {
    const { request: reqDocs, byField } = groupDocuments(
      parseDocuments(request?.documentsUrl),
    );
    return {
      requestDocs: reqDocs,
      fieldDocGroups: Object.entries(byField),
    };
  }, [request]);

  const bidders = child?.type === "pbl" ? child.bidders : null;
  const detailNote = childDetailNote(child);
  const isNew = meta?.statusLabel === "New";
  const isReadyForEngagement = meta?.statusLabel === "Ready for Engagement";
  // Status "R" (value 3) → reviewer can record a decision + comment on the request.
  const isReview = meta?.statusLabel === "R";

  // Verifier audit info backs the "General Review" section, shown once the
  // request has moved past "New" (i.e. it has been verified at least once).
  const [verifier, setVerifier] = useState<VerifierInfo | null>(null);
  useEffect(() => {
    if (!id || !meta || meta.statusLabel === "New") {
      setVerifier(null);
      return;
    }
    let cancelled = false;
    getVerifierInfo(id).then((info) => {
      if (!cancelled) setVerifier(info);
    });
    return () => {
      cancelled = true;
    };
  }, [id, meta]);

  return (
    <section className="rd-page">
      <div className="container">
        <div className="rd-back">
          <button
            type="button"
            className="rd-back-link"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to requests
          </button>
        </div>

        {isLoading && !request ? (
          <LoadingState message="Loading request details…" size="lg" />
        ) : null}

        {error ? (
          <InlineMessage tone="error" title="Couldn’t load this request">
            {error}
          </InlineMessage>
        ) : null}

        {!isLoading && !error && !request ? (
          <InlineMessage tone="warning" title="Request not found">
            We couldn’t find a request with this ID. It may have been removed,
            or you may not have permission to view it.{" "}
            <Link to="/requests">Return to the requests list.</Link>
          </InlineMessage>
        ) : null}

        {request && accessDenied ? (
          <InlineMessage tone="warning" title="You don’t have access to this request">
            This request belongs to another requestor. Redirecting you back to
            the requests list… <Link to="/requests">Go now.</Link>
          </InlineMessage>
        ) : null}

        {request && meta && !accessDenied ? (
          <>
            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="rd-hero">
              <div className="rd-hero-main">
                <h1 className="rd-hero-title mb-2">{meta.matterLabel}</h1>
                <div className="rd-hero-eyebrow">
                  {meta.matterCode ? (
                    <span
                      className={`rd-chan-badge chan-${meta.channel ?? "gcpc"}`}
                    >
                      {meta.matterCode}
                    </span>
                  ) : null}
                  <span className="rd-hero-id">
                    {request.title ?? `Request ${request.id.slice(0, 8)}`}
                  </span>
                </div>
              </div>

              <dl className="rd-hero-meta">
                <div className="rd-hero-stat">
                  <dt>
                    <Tag size={13} aria-hidden="true" /> Category
                  </dt>
                  <dd>{meta.categoryLabel ?? "—"}</dd>
                </div>
                <div className="rd-hero-stat">
                  <dt>
                    <Layers3 size={13} aria-hidden="true" /> Status
                  </dt>
                  <dd>
                    {meta.statusLabel ? (
                      <span className={`rq-status-pill ${meta.statusCls}`}>
                        <span className="rq-status-dot" />
                        {meta.statusLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </header>

            {/* ── Record meta strip ──────────────────────────────────── */}
            <div className="rd-recordbar">
              {request.projectName ? (
                <span className="rd-recordbar-item">
                  <Building2 size={14} aria-hidden="true" />
                  {request.projectName}
                </span>
              ) : null}
              {request.companyName ? (
                <span className="rd-recordbar-item">
                  <FileText size={14} aria-hidden="true" />
                  {request.companyName}
                </span>
              ) : null}
              {request.submittedOn ? (
                <span className="rd-recordbar-item">
                  <CalendarDays size={14} aria-hidden="true" />
                  {new Date(request.submittedOn).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </span>
              ) : null}
              {request.acknowledged ? (
                <span className="rd-recordbar-item rd-recordbar-ack">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Acknowledged
                </span>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="rd-recordbar-edit"
                  onClick={() => navigate(`/requests/${request.id}/edit`)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
              ) : null}
            </div>

            {childError ? (
              <InlineMessage
                tone="warning"
                title="Some details couldn’t be loaded"
                className="mb-3"
              >
                <span className="d-inline-flex align-items-center gap-1">
                  <CircleAlert size={14} aria-hidden="true" />
                  {childError}
                </span>
              </InlineMessage>
            ) : null}

            {/* ── Documents (request-level) ──────────────────────────── */}
            <DocumentsSection documents={requestDocs} />

            {/* ── Section 1: Basic Information ───────────────────────── */}
            <DetailSection
              title="Basic Information"
              icon={Info}
              fields={buildFields(basicInfoFields, request)}
            />

            {/* ── Section 2: Detail Information ──────────────────────── */}
            <DetailSection
              title="Detail Information"
              icon={ClipboardList}
              fields={detailFields}
            >
              {fieldDocGroups.map(([field, docs]) => (
                <div className="rd-doc-fieldgroup" key={field}>
                  <span className="rd-field-label">{fieldLabel(field)}</span>
                  <DocumentStrip documents={docs} />
                </div>
              ))}
              {bidders ? (
                <div className="rd-bidders-note">
                  <span className="rd-field-label">Prospective Bidders</span>
                  <BiddersTable bidders={bidders} />
                </div>
              ) : null}
              {detailNote}
            </DetailSection>

            {/* ── General Review (once past "New") ───────────────────── */}
            {!isNew
              ? (() => {
                  // Post-review records carry structured reviewer comments + a
                  // decision code; pre-review records carry only the verifier note.
                  const isPostReview = !!verifier?.reviewerComments;
                  const decisionCode = isPostReview
                    ? verifier?.decisionCode
                    : null;
                  const codeLabel =
                    decisionCode != null
                      ? (decisionCodeChoices.find(
                          (c) => c.value === decisionCode,
                        )?.label ?? null)
                      : null;
                  const codeDesc =
                    decisionCode != null
                      ? (decisionCodeDescriptions[decisionCode] ?? null)
                      : null;
                  const citeName = isPostReview
                    ? verifier?.reviewedByName
                    : verifier?.verifiedByName;

                  return (
                    <DetailSection title="General Review" icon={ClipboardCheck}>
                      {/* Comment */}
                      <div className="rd-bidders-note">
                        <span className="rd-field-label">Comment</span>
                        {isPostReview ? (
                          parseReviewComments(verifier!.reviewerComments!).map(
                            (block: ReviewCommentBlock, i: number) => {
                              if (block.type === "text") {
                                return (
                                  <p key={i} className="rd-multiline">
                                    {block.text || (
                                      <span className="rd-empty">—</span>
                                    )}
                                  </p>
                                );
                              }
                              const Tag =
                                block.type === "numbered-list" ? "ol" : "ul";
                              return (
                                <Tag key={i} className="rd-comment-list">
                                  {block.items.map((item, j) => (
                                    <li key={j}>{item}</li>
                                  ))}
                                </Tag>
                              );
                            },
                          )
                        ) : verifier?.comment ? (
                          <p className="rd-multiline">{verifier.comment}</p>
                        ) : (
                          <p className="rd-multiline rd-empty">—</p>
                        )}
                      </div>

                      {/* Decision Code (post-review only) */}
                      {codeLabel ? (
                        <div className="rd-bidders-note">
                          <span className="rd-field-label">Decision Code</span>
                          <div className="rd-decision-row">
                            <CheckSquare
                              size={18}
                              className="rd-decision-check"
                              aria-hidden="true"
                            />
                            <span className="rd-multiline">
                              <strong>{codeLabel}</strong>
                              {codeDesc ? ` : ${codeDesc}` : null}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {/* Footer cite — verified or reviewed by */}
                      {citeName ? (
                        <p className="rd-review-cite">
                          {isPostReview ? "Reviewed by:" : "Verified by:"}
                          <span className="sugg-by">
                            <span
                              className="rd-section-icon"
                              aria-hidden="true"
                            >
                              <User size={13} aria-hidden="true" />
                            </span>
                            {citeName}
                          </span>
                        </p>
                      ) : null}
                    </DetailSection>
                  );
                })()
              : null}

            {/* ── Actions ────────────────────────────────────────────── */}
            {isNew ? (
              <div className="rd-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  onClick={() =>
                    navigate(
                      `/requests/${request.id}/verify-data${
                        request.matter != null ? `?type=${request.matter}` : ""
                      }`,
                    )
                  }
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  Verify Data
                </button>
              </div>
            ) : null}

            {/* Draft Review → book an engagement/meeting with the reviewer. */}
            {isReadyForEngagement ? (
              <div className="rd-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (request.matter != null)
                      params.set("type", String(request.matter));
                    if (request.soaCode != null)
                      params.set("soacode", String(request.soaCode));
                    const qs = params.toString();
                    navigate(
                      `/requests/${request.id}/engagement${qs ? `?${qs}` : ""}`,
                    );
                  }}
                >
                  <CalendarCheck size={16} aria-hidden="true" />
                  Book Engagement
                </button>
              </div>
            ) : null}

            {/* Status R → reviewer records a decision + comment on the request. */}
            {isReview ? (
              <div className="rd-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (request.matter != null)
                      params.set("type", String(request.matter));
                    if (request.soaCode != null)
                      params.set("soacode", String(request.soaCode));
                    const qs = params.toString();
                    navigate(
                      `/requests/${request.id}/review${qs ? `?${qs}` : ""}`,
                    );
                  }}
                >
                  <ClipboardCheck size={16} aria-hidden="true" />
                  Review Request
                </button>
              </div>
            ) : null}

            {/* Draft Review → Working GCPC can add suggestions; admin/reviewer can view. */}
            {isDraftReview && (canAddSuggestion || suggestions.length > 0) ? (
              <div className="rd-actions rd-suggestion-actions">
                {/* Add Suggestion — Working GCPC only */}
                {canAddSuggestion ? (
                  <button
                    type="button"
                    className="rd-verify-btn rd-suggestion-add-btn"
                    onClick={() => setShowAddSuggestion(true)}
                  >
                    <MessageSquarePlus size={16} aria-hidden="true" />
                    Add Suggestion
                  </button>
                ) : null}

                {/* View Suggestions — only shown when suggestions exist */}
                {suggestions.length > 0 ? (
                  <button
                    type="button"
                    className="rd-verify-btn rd-suggestion-pulse-btn"
                    onClick={() => setShowViewSuggestions(true)}
                    aria-label={`${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""} — click to review`}
                  >
                    <MessageSquare size={16} aria-hidden="true" />
                    <span>{suggestions.length}</span>
                    <span className="rd-suggestion-dot" aria-hidden="true" />
                    Suggestion{suggestions.length !== 1 ? "s" : ""}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* ── Suggestion modals ──────────────────────────────────────── */}
            <AddSuggestionModal
              show={showAddSuggestion}
              requestId={request.id}
              contactId={user?.contactId ?? null}
              currentUserName={user?.name ?? ""}
              onHide={() => setShowAddSuggestion(false)}
              onSaved={() => {
                setShowAddSuggestion(false);
                void loadSuggestions();
              }}
            />
            <SuggestionsViewModal
              show={showViewSuggestions}
              requestId={request.id}
              suggestions={suggestions}
              onHide={() => setShowViewSuggestions(false)}
              onEditReview={() => {
                setShowViewSuggestions(false);
                const params = new URLSearchParams();
                if (request.matter != null)
                  params.set("type", String(request.matter));
                if (request.soaCode != null)
                  params.set("soacode", String(request.soaCode));
                const qs = params.toString();
                navigate(`/requests/${request.id}/review${qs ? `?${qs}` : ""}`);
              }}
            />

            {/* ── Signatures section (Pending Review status) ──────────── */}
            {isPendingReview ? (
              <SignatureSection
                requestId={request.id}
                currentUserEmail={user?.email ?? null}
                currentUserContactId={user?.contactId ?? null}
                currentUserLoginHint={user?.email ?? undefined}
                onReviewCompleted={() => void refetch()}
              />
            ) : null}

            {/* Complete Review (6) → HOC acceptance (both channels): select a
                conclusion code + sign. GCP then advances to Pending Ack (9),
                GCPC to Pending Endorse (11). */}
            {isCompleteReview && (isAdmin() || hasRole("HOC")) ? (
              <div className="rd-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  onClick={() =>
                    navigate(`/requests/${request.id}/hoc-acceptance`)
                  }
                >
                  <ClipboardCheck size={16} aria-hidden="true" />
                  HOC Acceptance
                </button>
              </div>
            ) : null}

            {/* Complete Acceptance (8) → reviewer finalises the letter. */}
            {isCompleteAcceptance && (isAdmin() || hasRole("Reviewer")) ? (
              <div className="rd-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  onClick={() =>
                    navigate(
                      meta.channel === "gcp"
                        ? `/requests/${request.id}/ack-letter`
                        : `/requests/${request.id}/endorsement-letter`,
                    )
                  }
                >
                  <Send size={16} aria-hidden="true" />
                  {meta.channel === "gcp"
                    ? "Acknowledgement Letter"
                    : "Endorsement Letter"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
