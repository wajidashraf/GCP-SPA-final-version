import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import FileUpload from '../FileUpload';
import type { UploadedFile } from '../FileUpload';
import SelectField from '../SelectField';
import TextAreaField from '../TextAreaField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition, SubmitResult } from '../multistep';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { DocumentStrip } from '../../components/detail/DocumentStrip';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import { requestCategoryChoices } from '../../data/requestChoices';
import {
  companyRoleInIssueChoices,
  type CompanyRoleInIssueValue,
} from '../../data/companyChoices';
import { ciCategoryOptions } from '../../data/ciChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitCiRequest } from './api';
import type { CiFormState } from './types';

type CiFormProps = {
  matter: MatterChoice;
  /** 'new' (default) creates a request; 'edit' patches an existing one. */
  mode?: 'new' | 'edit';
  /** Pre-filled state for edit mode (loaded from the existing record). */
  initialState?: CiFormState;
  /** Parent gcp_request id — present in edit mode. */
  requestId?: string;
  /** Existing documents on the record (edit mode) — parsed from gcp_documentsurl. */
  initialDocuments?: DocumentLink[];
  /**
   * Edit-mode submit handler: receives the current form state plus the final
   * document set (kept existing links + new uploads) to persist.
   */
  onEditSubmit?: (
    state: CiFormState,
    documents: DocumentLink[]
  ) => Promise<SubmitResult>;
  /** Called by the success screen's primary button in edit mode (navigate back). */
  onEditSuccess?: () => void;
};

const DRAFT_KEY = 'ci:new';

const HalfCol = ({ children }: { children: ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

const CiForm = ({
  matter,
  mode = 'new',
  initialState,
  requestId,
  initialDocuments,
  onEditSubmit,
  onEditSuccess,
}: CiFormProps) => {
  const { user } = useAuth();
  const isEdit = mode === 'edit';

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: CiFormState = initialState ?? {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    companyName: user?.company ?? '',
    projectId: '',
    projectName: '',
    projectCode: '',
    companyRole: '',

    category: '',
    chronologyOfEventVo: '',
    briefOfIssuesVo: '',
    timeAndCostImpactVo: '',
    contractClause: '',
    advisoryRequiredVo: '',

    briefOfIssuesPayments: '',
    chronologyOfEventPayments: '',
    contractClausePayment: '',
    advisoryRequiredPayments: '',

    acknowledged: false,
  };

  // Edit mode never touches the new-request draft (would clobber the loaded
  // record / leak edits across records). New mode persists as before.
  const { state, setState, clearDraft } = useFormDraft<CiFormState>(
    DRAFT_KEY,
    initial,
    { persist: !isEdit }
  );
  const [isSubmitting, setSubmitting] = useState(false);

  // Request-level attachments added on the final step. File objects can't be
  // serialized into the draft, so this lives in component state; their
  // SharePoint links are persisted on gcp_documentsurl at submit (field: null).
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  // Edit mode: every existing document on this record is shown and removable —
  // request-level attachments and per-field uploads alike — so nothing is hidden
  // from the editor and a re-upload cannot silently duplicate a file.
  const [existingDocs, setExistingDocs] = useState<DocumentLink[]>(() => [
    ...(initialDocuments ?? []),
  ]);
  const removeExistingDoc = (doc: DocumentLink) =>
    setExistingDocs((prev) => prev.filter((d) => d !== doc));

  // Stable draft id to fold this request's uploads into one SharePoint folder
  // before the request record exists.
  const draftId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `draft-${Date.now().toString(36)}`,
    []
  );

  // In edit mode the request already exists — fold uploads into its real folder.
  // In new mode the record doesn't exist yet, so use the stable draft id.
  const uploadRequestId = isEdit && requestId ? requestId : draftId;

  const attachmentsUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'ci',
        requestId: uploadRequestId,
        loginHint: user?.email,
      }),
    [uploadRequestId, user?.email]
  );

  const set = <K extends keyof CiFormState>(key: K, value: CiFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Sync company lookup to logged-in user's parent account. Edit mode keeps the
  // saved company — the logged-in user may be a Reviewer/Verifier editing
  // someone else's request, not the original requestor.
  useEffect(() => {
    if (isEdit) return;
    if (!user?.companyAccountId) return;
    if (
      state.companyId === user.companyAccountId &&
      state.companyName === (user.company ?? '')
    ) {
      return;
    }
    setState((prev) => ({
      ...prev,
      companyId: user.companyAccountId ?? '',
      companyName: user.company ?? '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyAccountId, user?.company, isEdit]);

  // Sync requestor name + email when AuthContext hydrates. Edit mode keeps the
  // original requestor's details (do not overwrite with the editing user).
  useEffect(() => {
    if (isEdit) return;
    if (!user?.email) return;
    setState((prev) => {
      if (
        prev.requestorEmail === user.email &&
        prev.requestorName === user.name
      ) {
        return prev;
      }
      return {
        ...prev,
        requestorContactId: prev.requestorContactId || user.email,
        requestorName: user.name,
        requestorEmail: user.email,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.name]);

  // Load active projects for the step 2 project dropdown.
  const [projects, setProjects] = useState<GcpProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);
    listActiveProjects({ pageSize: 200, withFormattedValues: true })
      .then((res) => {
        if (cancelled) return;
        setProjects(res.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setProjectsError(
          err instanceof Error ? err.message : 'Failed to load projects.'
        );
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matterOptions = useMemo(
    () =>
      toSelectOptions(
        matterChoices.map((m) => ({ label: m.label, value: m.value }))
      ),
    []
  );
  const categoryOptions = useMemo(
    () => toSelectOptions(requestCategoryChoices),
    []
  );
  const companyRoleOptions = useMemo(
    () => toSelectOptions(companyRoleInIssueChoices),
    []
  );
  // Render from state (not `user`) so edit mode shows the saved requestor, not
  // the editing user — see the identity rule in docs/edit-request-mode-plan.md.
  const requestorOptions = state.requestorContactId
    ? [
        {
          label: state.requestorName || state.requestorEmail,
          value: state.requestorContactId,
        },
      ]
    : [];
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        label: p.name || p.code || p.id,
        value: p.id,
      })),
    [projects]
  );

  const onProjectSelect = (id: string) => {
    const project = projects.find((p) => p.id === id);
    setState((prev) => ({
      ...prev,
      projectId: id,
      projectName: project?.name ?? '',
      projectCode: project?.code ?? '',
    }));
  };

  const steps: StepDefinition[] = [
    {
      label: 'Basic Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <SelectField
              name="matter"
              label="Matter / Request Title"
              options={matterOptions}
              value={String(state.matterValue)}
              isRequired
              isReadOnly
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="category"
              label="Category"
              options={categoryOptions}
              value={String(state.categoryValue)}
              isRequired
              isReadOnly
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="requestorName"
              label="Requestor Name"
              options={requestorOptions}
              value={state.requestorContactId}
              isRequired
              isReadOnly
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="requestorEmail"
              label="Requestor Email"
              value={state.requestorEmail}
              isRequired
              isReadOnly
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="company"
              label="Company Name"
              options={
                state.companyId
                  ? [
                      {
                        label: state.companyName || 'Loading…',
                        value: state.companyId,
                      },
                    ]
                  : []
              }
              value={state.companyId}
              isRequired
              isReadOnly
              placeholder={
                state.companyId
                  ? state.companyName || 'Loading…'
                  : 'No company linked'
              }
            />
          </HalfCol>
        </Row>
      ),
      validate: () => {
        if (!state.requestorEmail.trim()) return 'Requestor email is required.';
        if (!state.companyId) return 'Company is required.';
        return null;
      },
    },
    {
      label: 'Project Details',
      render: () => (
        <Row className="g-3">
          {projectsError ? (
            <Col xs={12}>
              <div className="alert alert-danger mb-0">{projectsError}</div>
            </Col>
          ) : null}
          <HalfCol>
            <SelectField
              name="project"
              label="Project Name"
              options={projectOptions}
              value={state.projectId}
              onChange={(e) => onProjectSelect(e.target.value)}
              isRequired
              placeholder={
                projectsLoading
                  ? 'Loading projects…'
                  : projectOptions.length === 0
                  ? 'No active projects available'
                  : 'Select a project'
              }
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="projectCode"
              label="Project Code"
              value={state.projectCode}
              isReadOnly
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="companyRole"
              label="Company Role in this Issue"
              options={companyRoleOptions}
              value={state.companyRole === '' ? '' : String(state.companyRole)}
              onChange={(e) =>
                set(
                  'companyRole',
                  e.target.value === ''
                    ? ''
                    : (Number(e.target.value) as CompanyRoleInIssueValue)
                )
              }
              isRequired
            />
          </HalfCol>
        </Row>
      ),
      validate: () => {
        if (!state.projectId) return 'Project is required.';
        if (state.companyRole === '')
          return 'Company role in this issue is required.';
        return null;
      },
    },
    {
      label: 'VO / EOT / L&E Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <SelectField
              name="ciCategory"
              label="Category"
              options={ciCategoryOptions}
              value={state.category}
              onChange={(e) => set('category', e.target.value)}
              isRequired
              placeholder="Select a category"
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="contractClause"
              label="Contract Clause"
              value={state.contractClause}
              onChange={(e) => set('contractClause', e.target.value)}
            />
          </HalfCol>
          <Col xs={12}>
            <TextAreaField
              name="chronologyOfEventVo"
              label="Chronology of Event"
              value={state.chronologyOfEventVo}
              onChange={(e) => set('chronologyOfEventVo', e.target.value)}
              rows={3}
            />
          </Col>
          <Col xs={12}>
            <TextAreaField
              name="briefOfIssuesVo"
              label="Brief of Issues"
              value={state.briefOfIssuesVo}
              onChange={(e) => set('briefOfIssuesVo', e.target.value)}
              rows={3}
            />
          </Col>
          <Col xs={12}>
            <TextAreaField
              name="timeAndCostImpactVo"
              label="Time and Cost Impact"
              value={state.timeAndCostImpactVo}
              onChange={(e) => set('timeAndCostImpactVo', e.target.value)}
              rows={3}
            />
          </Col>
          <Col xs={12}>
            <TextAreaField
              name="advisoryRequiredVo"
              label="Advisory Required from GCP"
              value={state.advisoryRequiredVo}
              onChange={(e) => set('advisoryRequiredVo', e.target.value)}
              rows={3}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: 'Payments Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="contractClausePayment"
              label="Contract Clause (Payment)"
              value={state.contractClausePayment}
              onChange={(e) => set('contractClausePayment', e.target.value)}
            />
          </HalfCol>
          <Col xs={12}>
            <TextAreaField
              name="briefOfIssuesPayments"
              label="Brief of Issues (Payments)"
              value={state.briefOfIssuesPayments}
              onChange={(e) => set('briefOfIssuesPayments', e.target.value)}
              rows={3}
            />
          </Col>
          <Col xs={12}>
            <TextAreaField
              name="chronologyOfEventPayments"
              label="Chronology of Event (Payments)"
              value={state.chronologyOfEventPayments}
              onChange={(e) => set('chronologyOfEventPayments', e.target.value)}
              rows={3}
            />
          </Col>
          <Col xs={12}>
            <TextAreaField
              name="advisoryRequiredPayments"
              label="Advisory Required from GCP (Payments)"
              value={state.advisoryRequiredPayments}
              onChange={(e) => set('advisoryRequiredPayments', e.target.value)}
              rows={3}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: 'Document',
      render: () => (
        <Row className="g-3">
          {/* Edit mode: existing documents on this record, each removable.
              Removing a file detaches it from the record (drops the link); the
              file itself remains in SharePoint. */}
          {isEdit && existingDocs.length > 0 ? (
            <Col xs={12}>
              <label className="rtp-doc-label">Existing documents</label>
              <DocumentStrip
                documents={existingDocs}
                onRemove={removeExistingDoc}
              />
            </Col>
          ) : null}
          <Col xs={12}>
            <FileUpload
              label={isEdit ? 'Add documents' : 'Attachments'}
              value={attachments}
              onChange={setAttachments}
              uploader={attachmentsUploader}
            />
          </Col>
          <Col xs={12}>
            <CheckboxField
              name="acknowledged"
              label="I acknowledge that the uploaded document and submitted details are accurate."
              checked={state.acknowledged}
              onChange={(e) => set('acknowledged', e.target.checked)}
              isRequired
            />
          </Col>
        </Row>
      ),
      validate: () => {
        if (!state.acknowledged)
          return 'You must acknowledge before submitting.';
        return null;
      },
    },
  ];

  const handleSubmit = async () => {
    // Edit mode: delegate the PATCH to the caller, which has the record ids.
    if (isEdit) {
      if (!onEditSubmit) {
        throw new Error('Edit mode requires an onEditSubmit handler.');
      }
      setSubmitting(true);
      try {
        // Final document set = per-field docs (untouched) + kept existing
        // request-level docs + newly uploaded files (field: null).
        const newDocs = documentsFromUploads(
          attachments.map((f) => ({
            name: f.file.name,
            url: f.url,
            id: f.remoteId,
          })),
          null,
          new Date().toISOString()
        );
        const documents = [...existingDocs, ...newDocs];
        return await onEditSubmit(state, documents);
      } finally {
        setSubmitting(false);
      }
    }

    setSubmitting(true);
    try {
      // Final-step attachments belong to the request itself (field: null).
      const documents = documentsFromUploads(
        attachments.map((f) => ({
          name: f.file.name,
          url: f.url,
          id: f.remoteId,
        })),
        null,
        new Date().toISOString()
      );

      const result = await submitCiRequest(state, {
        requestorContactId: user?.contactId ?? null,
        documents,
      });
      clearDraft();
      const emailSent = await notifyEvent(result.requestId, 'request_submitted', user?.email);
      return {
        reference: result.requestId,
        toast: emailSent
          ? { message: 'Request submitted successfully. Notification email sent.', tone: 'success' as const }
          : { message: 'Request submitted successfully — notification email could not be sent.', tone: 'error' as const },
      };
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MultiStepForm
      title={matter.label}
      subtitle={`Channel: ${matter.channel.toUpperCase()} · Code: ${matter.code}`}
      steps={steps}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : undefined}
      successTitle={isEdit ? 'Changes saved' : undefined}
      successMessage={
        isEdit
          ? 'Your changes have been saved. The request stays in Resubmit until it is moved forward in the workflow.'
          : undefined
      }
      successActionLabel={isEdit ? 'Back to request' : undefined}
      onSuccessAction={isEdit ? onEditSuccess : undefined}
    />
  );
};

export default CiForm;
export { CiForm };
