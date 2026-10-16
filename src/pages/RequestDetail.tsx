import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
  Printer,
  Save,
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
import {
  canEditRequest,
  canEditReviewerComment,
} from "../shared/requestEditPolicy";
import { canSubmitEndorsement } from "../shared/endorsementSubmission";
import {
  getVerifierInfo,
  isRequestResubmittedForReview,
  saveReviewerComments,
} from "../shared/services/requestService";
import type { VerifierInfo } from "../shared/services/requestService";
import { listSuggestionsForRequest } from "../shared/services/suggestionService";
import type { GcpSuggestion } from "../shared/services/suggestionService";
import { getChoiceLabel } from "../data/types";
import {
  decisionCodeChoices,
  decisionCodeDescriptions,
  outcomeChoices,
  registrationTypeChoices,
  requestCategoryChoices,
  requestStatusChoices,
} from "../data/requestChoices";
import {
  TextAreaField,
  hasStoredReviewComments,
  parseReviewComments,
  reviewCommentsToText,
  serializeReviewComments,
} from "../forms";
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
import { getRequestsReturnPath } from "../shared/requestListState";
import { canCreateEngagementBooking, canRescheduleEngagementBooking, isRequestOwnerOrAdmin } from '../shared/engagementBookingPolicy';
import { useRequestEngagements } from '../shared/hooks/useRequestEngagements';
import { printRequestRecord } from '../shared/requestPrint';
import { getRequestStatusDisplayLabel } from '../shared/requestStatusPresentation';
import { combineDetailRecordFields } from '../shared/requestDetailRecordFields';
import { ENGAGEMENT_STATUS_SCHEDULED } from '../data/engagementChoices';

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
  { label: "Remarks", kind: "multiline", full: true, get: (r) => r.projectDescription },
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
  const groups = child?.type === 'rtp'
    ? child.records.map((record) => buildFields(rtpDetailFields, record))
    : child && child.type !== 'unsupported'
      ? child.records.map((record) => flattenChildFields({ ...child, records: [record] } as ChildData))
      : [];
  return combineDetailRecordFields(buildFields(parentDetailFields, request), groups, BASIC_INFO_LABELS);
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
  const location = useLocation();
  const requestsReturnPath = getRequestsReturnPath(location.state);
  const { request, child, isLoading, error, childError, refetch } =
    useRequestDetail(id);
  const { user, isLoading: authLoading } = useAuth();
  const recordRef = useRef<HTMLElement>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

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
      isRequestOwnerOrAdmin(request.requestorContactId, { contactId: user?.contactId, isAdmin: false });
    if (isOwner) return false;
    const isHocForCompany =
      hasRole("HOC") &&
      !!user?.companyAccountId &&
      request.companyId === user.companyAccountId;
    if (isHocForCompany) return false;
    return true;
  }, [request, authLoading, user]);

  const accessibleRequestId = !authLoading && !accessDenied ? request?.id : null;
  const bookingActor = { contactId: user?.contactId, isAdmin: isAdmin() };
  const bookingHistory = useRequestEngagements(accessibleRequestId, !!request && isRequestOwnerOrAdmin(request.requestorContactId, bookingActor));
  const bookingRequest = request ? { ...request, ...bookingHistory.bookingRequest } : null;
  const canPrint = !authLoading && !!request && !accessDenied && isRequestOwnerOrAdmin(request.requestorContactId, bookingActor);
  const scheduledBookings = bookingHistory.items.filter((engagement) => engagement.status === ENGAGEMENT_STATUS_SCHEDULED);
  const canEditBooking = !!request && !authLoading && !accessDenied && !bookingHistory.loading && !bookingHistory.error &&
    scheduledBookings.length === 1 && !!bookingRequest && canRescheduleEngagementBooking(bookingRequest, bookingActor);

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
  // GCP acknowledgement accepts Pending Ack (9) plus legacy Complete
  // Acceptance (8). GCPC endorsement uses canSubmitEndorsement below.
  const isAcknowledgementReady =
    request?.status === 8 || request?.status === 9;
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
    const currentStatus = bookingRequest?.status ?? request.status;
    const statusLabel =
      currentStatus != null
        ? (getChoiceLabel(requestStatusChoices, currentStatus) ?? null)
        : null;
    const outcomeLabel =
      request.outcome != null
        ? (getChoiceLabel(outcomeChoices, request.outcome) ?? null)
        : null;
    return {
      matterLabel: matter?.label ?? "Request",
      matterCode: matter?.code ?? null,
      channel: matter?.channel ?? null,
      categoryLabel,
      soaLabel,
      statusLabel,
      statusCls: statusLabel ? (statusClass[statusLabel] ?? "status-new") : "",
      outcomeLabel,
      outcomeCls: outcomeLabel
        ? (statusClass[outcomeLabel] ?? "status-new")
        : "",
    };
  }, [request, bookingRequest?.status]);

  const isResubmittedForReview = request
    ? isRequestResubmittedForReview(request)
    : false;
  // Code 1 has a mapped Dataverse outcome for downstream workflow processing,
  // but the Detail page intentionally shows Outcome only for Code 2/3/4/W.
  const showOutcome =
    request?.decisionCode !== 1 && meta?.outcomeLabel != null;

  // Edit gate — New, R, and RS are editable by the original requestor,
  // Reviewer, Verifier, or admin when the matter has a registered edit form.
  // Authoritative checks remain the table permissions + EditRequest guards.
  const canEdit = useMemo(() => {
    if (!request || authLoading) return false;
    if (!hasEditForm(meta?.matterCode)) return false;
    return canEditRequest(
      {
        status: request.status,
        requestorContactId: request.requestorContactId,
      },
      {
        contactId: user?.contactId,
        isAdmin: isAdmin(),
        isReviewer: hasRole("Reviewer"),
        isVerifier: hasRole("Verifier"),
      },
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
  // Status "R" (value 3) → reviewer can record a decision + comment on the request.
  const isReview = meta?.statusLabel === "R";
  const isReviewerCommentCycleOpen =
    !authLoading &&
    !!request &&
    canEditReviewerComment(request, {
      isAdmin: isAdmin(),
      isReviewer: hasRole("Reviewer"),
    });

  // Verifier audit info backs the "General Review" section, shown once the
  // request has moved past "New" (i.e. it has been verified at least once).
  const [verifier, setVerifier] = useState<VerifierInfo | null>(null);
  const [verifierInfoLoaded, setVerifierInfoLoaded] = useState(false);
  const [verifierInfoError, setVerifierInfoError] = useState<string | null>(null);
  const [reviewCommentText, setReviewCommentText] = useState("");
  const [isEditingReviewComment, setIsEditingReviewComment] = useState(false);
  const [isSavingReviewComment, setIsSavingReviewComment] = useState(false);
  const [reviewCommentError, setReviewCommentError] = useState<string | null>(
    null,
  );
  const loadVerifierInfo = useCallback(async () => {
    if (!id || !meta || meta.statusLabel === "New") {
      setVerifier(null);
      setVerifierInfoLoaded(true);
      setVerifierInfoError(null);
      return null;
    }
    setVerifierInfoLoaded(false);
    setVerifierInfoError(null);
    try {
      const info = await getVerifierInfo(id);
      setVerifier(info);
      setVerifierInfoLoaded(true);
      return info;
    } catch (loadError) {
      setVerifierInfoError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the reviewer comment.",
      );
      return null;
    }
  }, [id, meta]);
  useEffect(() => {
    if (!id || !meta || meta.statusLabel === "New") {
      setVerifier(null);
      setVerifierInfoLoaded(true);
      setVerifierInfoError(null);
      return;
    }
    setVerifierInfoLoaded(false);
    setVerifierInfoError(null);
    let cancelled = false;
    getVerifierInfo(id)
      .then((info) => {
        if (!cancelled) {
          setVerifier(info);
          setVerifierInfoLoaded(true);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setVerifierInfoError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the reviewer comment.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, meta]);

  const hasSavedReviewerComment = hasStoredReviewComments(
    verifier?.reviewerComments,
  );

  useEffect(() => {
    if (!verifierInfoLoaded || isEditingReviewComment) return;
    setReviewCommentText(reviewCommentsToText(verifier?.reviewerComments));
  }, [
    isEditingReviewComment,
    verifierInfoLoaded,
    verifier?.reviewerComments,
  ]);

  const handleEditReviewComment = () => {
    setReviewCommentText(reviewCommentsToText(verifier?.reviewerComments));
    setReviewCommentError(null);
    setIsEditingReviewComment(true);
  };

  const handleCancelReviewComment = () => {
    setReviewCommentText(reviewCommentsToText(verifier?.reviewerComments));
    setReviewCommentError(null);
    setIsEditingReviewComment(false);
  };

  const handleSaveReviewComment = async () => {
    if (!id || !isReviewerCommentCycleOpen || !verifierInfoLoaded) return;
    if (!reviewCommentText.trim()) {
      setReviewCommentError("Reviewer comment is required before review.");
      return;
    }

    setIsSavingReviewComment(true);
    setReviewCommentError(null);
    try {
      const reviewerComments = serializeReviewComments([
        { type: "text", text: reviewCommentText },
      ]);
      await saveReviewerComments(id, {
        reviewerComments,
        reviewedByContactId: user?.contactId,
      });
      const refreshed = await loadVerifierInfo();
      if (!refreshed) return;
      setIsEditingReviewComment(false);
    } catch (saveError) {
      setReviewCommentError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the reviewer comment.",
      );
    } finally {
      setIsSavingReviewComment(false);
    }
  };

  const printBlocked = isLoading || Boolean(childError) || !verifierInfoLoaded || Boolean(verifierInfoError) || isEditingReviewComment;
  const handlePrint = async () => {
    if (!canPrint || !recordRef.current || printing) return;
    setPrintError(null);
    if (printBlocked) {
      setPrintError(isEditingReviewComment ? 'Save or cancel the current comment edit before printing.' : 'Wait for all request sections to load, or retry the missing information before printing.');
      return;
    }
    setPrinting(true);
    try {
      await printRequestRecord(recordRef.current);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Could not prepare the complete request for printing.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <section className="rd-page rd-request-record" ref={recordRef} key={id}
      data-request-id={accessibleRequestId ?? ''} data-print-ready={!printBlocked && !!accessibleRequestId ? 'true' : 'false'}>
      <div className="container">
        <div className="rd-back">
          <button
            type="button"
            className="rd-back-link"
            onClick={() => navigate(requestsReturnPath)}
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

        {request && meta && !authLoading && !accessDenied ? (
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
                        {getRequestStatusDisplayLabel(bookingRequest?.status ?? request.status)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {showOutcome ? (
                  <div className="rd-hero-stat">
                    <dt>
                      <ClipboardCheck size={13} aria-hidden="true" /> Outcome
                    </dt>
                    <dd>
                      <span className={`rq-status-pill ${meta.outcomeCls}`}>
                        <span className="rq-status-dot" />
                        {meta.outcomeLabel}
                      </span>
                    </dd>
                  </div>
                ) : null}
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
              {canEdit || canEditBooking || canPrint ? (
                <div className="rd-recordbar-actions no-print" role="group" aria-label="Request actions">
                  {canEdit ? (
                    <button
                      type="button"
                      className="rd-recordbar-edit no-print"
                      onClick={() => navigate(`/requests/${request.id}/edit`)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Edit
                    </button>
                  ) : null}
                  {canEditBooking ? (
                    <button type="button" className="rd-recordbar-edit no-print" onClick={() => navigate(`/requests/${request.id}/engagement?edit=1`)}>
                      <CalendarCheck size={14} aria-hidden="true" /> Edit Booking
                    </button>
                  ) : null}
                  {canPrint ? (
                    <button type="button" className="rd-recordbar-edit no-print" disabled={printing} onClick={() => void handlePrint()}>
                      <Printer size={14} aria-hidden="true" /> {printing ? 'Preparing print…' : 'Print'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {printError ? (
              <InlineMessage tone="error" title="Request could not be printed" className="no-print">
                {printError}
                <button type="button" className="vd-btn-secondary" onClick={() => {
                  setPrintError(null);
                  void refetch();
                  void loadVerifierInfo();
                }}>Reload request information</button>
              </InlineMessage>
            ) : null}

            {Number(request.status) === 16 &&
            Number(request.outcome) === 4 ? (
              <InlineMessage
                tone={isResubmittedForReview ? "info" : "warning"}
                title={
                  isResubmittedForReview
                    ? "Resubmitted — awaiting review"
                    : "Changes required"
                }
                className="mb-3"
              >
                {isResubmittedForReview ? (
                  <>
                    Changes were submitted
                    {request.lastUpdatedDate
                      ? ` on ${new Date(request.lastUpdatedDate).toLocaleString()}`
                      : ""}
                    . A reviewer can now complete the re-review. The request
                    remains editable while its status is RS.
                  </>
                ) : (
                  <>
                    The reviewer selected Code 2. Update the request and submit
                    the changes for re-review.
                  </>
                )}
              </InlineMessage>
            ) : null}

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
                  const isPostReview = hasSavedReviewerComment;
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
                    <>
                      <DetailSection title="General Review" icon={ClipboardCheck}>
                      {/* Comment */}
                      <div className="rd-bidders-note rd-review-comment">
                        <div className="rd-review-comment-heading">
                          <span className="rd-field-label">Comment</span>
                          {isReviewerCommentCycleOpen &&
                          hasSavedReviewerComment &&
                          !isEditingReviewComment ? (
                            <button
                              type="button"
                              className="rd-review-comment-edit"
                              aria-label="Edit reviewer comment"
                              onClick={handleEditReviewComment}
                            >
                              <Pencil size={15} aria-hidden="true" />
                              Edit
                            </button>
                          ) : null}
                        </div>

                        {verifierInfoError ? (
                          <InlineMessage
                            tone="error"
                            title="Could not load reviewer comment"
                          >
                            <span>{verifierInfoError}</span>{" "}
                            <button
                              type="button"
                              className="rd-inline-retry"
                              onClick={() => void loadVerifierInfo()}
                            >
                              Try again
                            </button>
                          </InlineMessage>
                        ) : !verifierInfoLoaded ? (
                          <LoadingState message="Loading reviewer comment…" />
                        ) : isPostReview ? (
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

                      {verifierInfoLoaded &&
                      !verifierInfoError &&
                      isReviewerCommentCycleOpen &&
                      (!hasSavedReviewerComment || isEditingReviewComment) ? (
                        <div className="rd-review-comment-editor mb-3 no-print">
                          <TextAreaField
                            id="reviewer-comment"
                            label="Reviewer Comment"
                            value={reviewCommentText}
                            onChange={(event) => {
                              setReviewCommentText(event.target.value);
                              setReviewCommentError(null);
                            }}
                            rows={5}
                            isRequired
                            disabled={isSavingReviewComment}
                            error={reviewCommentError ?? undefined}
                            helpText="Save this comment before selecting a review code."
                          />
                          <div className="rd-review-comment-save-row">
                            {hasSavedReviewerComment ? (
                              <button
                                type="button"
                                className="rd-comment-cancel"
                                disabled={isSavingReviewComment}
                                onClick={handleCancelReviewComment}
                              >
                                Cancel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rd-comment-save"
                              disabled={isSavingReviewComment}
                              onClick={() => void handleSaveReviewComment()}
                            >
                              <Save size={15} aria-hidden="true" />
                              {isSavingReviewComment
                                ? "Saving…"
                                : "Save comment"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()
              : null}

            {/* ── Actions ────────────────────────────────────────────── */}
            {/* New → Verifier (or admin) verifies the submitted data. */}
            {isNew && (isAdmin() || hasRole("Verifier")) ? (
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

            {bookingHistory.error && canCreateEngagementBooking(bookingRequest ?? request, bookingActor) ? (
              <InlineMessage tone="error" title="Booking actions could not be loaded" className="no-print">
                {bookingHistory.error}
                <button type="button" className="vd-btn-secondary" onClick={() => void bookingHistory.refetch()}>
                  Retry booking actions
                </button>
              </InlineMessage>
            ) : null}

            {/* Draft Review → book an engagement/meeting with the reviewer. */}
            {(bookingRequest?.status === 2 || (bookingRequest?.status === 3 && scheduledBookings.length === 0)) &&
            !bookingHistory.loading && !bookingHistory.error && scheduledBookings.length === 0 && canCreateEngagementBooking(bookingRequest ?? request, bookingActor) ? (
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

            {/* Initial R or a submitted RS edit → Reviewer/Admin records a decision. */}
            {(isReview || isResubmittedForReview) &&
            (isAdmin() || hasRole("Reviewer")) ? (
              <div className="rd-actions rd-review-actions">
                <button
                  type="button"
                  className="rd-verify-btn"
                  disabled={
                    !verifierInfoLoaded ||
                    !hasSavedReviewerComment ||
                    isSavingReviewComment
                  }
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
                  {isResubmittedForReview
                    ? "Review Resubmission"
                    : "Review Request"}
                </button>
                {verifierInfoError ? (
                  <p className="rd-review-required-note" role="status">
                    Reload the reviewer comment before continuing.
                  </p>
                ) : verifierInfoLoaded && !hasSavedReviewerComment ? (
                  <p className="rd-review-required-note" role="status">
                    Save a reviewer comment below before continuing.
                  </p>
                ) : null}
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
              <div className="no-print">
              <SignatureSection
                requestId={request.id}
                currentUserEmail={user?.email ?? null}
                currentUserContactId={user?.contactId ?? null}
                currentUserLoginHint={user?.email ?? undefined}
                onReviewCompleted={() => void refetch()}
              />
              </div>
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

            {/* GCP acknowledgement is Reviewer/Admin; GCPC endorsement is
                Endorser/Admin. Both retain legacy status 8 support. */}
            {(meta.channel === "gcp" &&
              isAcknowledgementReady &&
              (isAdmin() || hasRole("Reviewer"))) ||
            (meta.channel === "gcpc" &&
              canSubmitEndorsement(request.status, {
                isAdmin: isAdmin(),
                isEndorser: hasRole("Endorser"),
              })) ? (
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
