import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import DateField from '../DateField';
import DynamicTableSection from '../DynamicTableSection';
import FileUpload from '../FileUpload';
import RepeatableTextField from '../RepeatableTextField';
import SelectField from '../SelectField';
import TextAreaField from '../TextAreaField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition } from '../multistep';
import type { TableData, UploadedFile } from '..';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import { requestCategoryChoices } from '../../data/requestChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitStspRequest } from './api';
import type { StspFormState } from './types';

type StspFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'stsp:new';

/** Field key the contract-structure upload is tagged with on gcp_documentsurl. */
const CONTRACT_STRUCTURE_FIELD = 'contractStructureImage';

const HalfCol = ({ children }: { children: ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

/** Parse a DynamicTableSection JSON string back into its controlled value. */
const parseTableData = (value: string): TableData | undefined => {
  if (!value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as TableData;
  } catch {
    // ignore — fall through to undefined
  }
  return undefined;
};

const StspForm = ({ matter }: StspFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: StspFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',

    projectId: '',
    projectName: '',
    projectCode: '',
    tenderProposalSubmissionDate: '',
    tenderValidityPeriod: '',

    picTeamLeader: '',
    picFinancialMatters: '',
    picTechnicalMatters: '',
    picContractMatters: '',
    picProcurementMatters: '',
    picCostingAndEstimationMatters: '',
    picImplementationStage: '',

    backgroundReview: '',
    scopeOfWorks: '',
    keyTerms: '',
    financials: '',

    technical: '',
    procurementStrategyWorkPackages: '',
    sourcingReference: '',
    costBreakdown: '',
    riskIdentificationMitigationPlan: '',

    acknowledged: false,
  };

  const { state, setState, clearDraft } = useFormDraft<StspFormState>(
    DRAFT_KEY,
    initial
  );
  const [isSubmitting, setSubmitting] = useState(false);

  // "Contract Structure Image" upload. Files upload to SharePoint immediately
  // (via the uploader below); their links are persisted on the request's
  // gcp_documentsurl at submit, tagged with the field. File objects can't be
  // serialized into the draft, so this lives in component state.
  const [contractStructureFiles, setContractStructureFiles] = useState<
    UploadedFile[]
  >([]);

  // Last-step general attachments (field: null — belongs to the request itself).
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  // Stable draft id to fold this request's uploads into one SharePoint folder
  // before the request record exists.
  const draftId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `draft-${Date.now().toString(36)}`,
    []
  );

  const contractStructureUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'stsp',
        requestId: draftId,
        fieldName: CONTRACT_STRUCTURE_FIELD,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const attachmentsUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'stsp',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof StspFormState>(
    key: K,
    value: StspFormState[K]
  ) => setState((prev) => ({ ...prev, [key]: value }));

  // Sync company lookup to logged-in user's parent account.
  useEffect(() => {
    if (!user?.companyAccountId) return;
    if (state.companyId === user.companyAccountId) return;
    setState((prev) => ({ ...prev, companyId: user.companyAccountId ?? '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyAccountId]);

  // Sync requestor name + email when AuthContext hydrates.
  useEffect(() => {
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
  const requestorOptions = user
    ? [{ label: user.name, value: user.email }]
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

  const companyOptions = user?.companyAccountId
    ? [{ label: user.company || 'Loading…', value: user.companyAccountId }]
    : [];

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
              label="Company"
              options={companyOptions}
              value={user?.companyAccountId ?? ''}
              isRequired
              isReadOnly
              placeholder={
                user?.companyAccountId
                  ? user.company || 'Loading…'
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
              name="company"
              label="Company Name"
              options={companyOptions}
              value={user?.companyAccountId ?? ''}
              isReadOnly
              placeholder={
                user?.companyAccountId
                  ? user.company || 'Loading…'
                  : 'No company linked'
              }
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="tenderProposalSubmissionDate"
              label="Tender/Proposal Submission Date"
              value={state.tenderProposalSubmissionDate}
              onChange={(e) =>
                set('tenderProposalSubmissionDate', e.target.value)
              }
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="tenderValidityPeriod"
              label="Tender Validity Period (Days)"
              value={state.tenderValidityPeriod}
              onChange={(e) => set('tenderValidityPeriod', e.target.value)}
            />
          </HalfCol>
        </Row>
      ),
      validate: () => {
        if (!state.projectId) return 'Project is required.';
        return null;
      },
    },
    {
      label: 'PIC',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="picTeamLeader"
              label="Team Leader"
              value={state.picTeamLeader}
              onChange={(e) => set('picTeamLeader', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picFinancialMatters"
              label="Financial Matters"
              value={state.picFinancialMatters}
              onChange={(e) => set('picFinancialMatters', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picTechnicalMatters"
              label="Technical Matters"
              value={state.picTechnicalMatters}
              onChange={(e) => set('picTechnicalMatters', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picContractMatters"
              label="Contract Matters"
              value={state.picContractMatters}
              onChange={(e) => set('picContractMatters', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picProcurementMatters"
              label="Procurement Matters"
              value={state.picProcurementMatters}
              onChange={(e) => set('picProcurementMatters', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picCostingAndEstimationMatters"
              label="Costing And Estimation Matters"
              value={state.picCostingAndEstimationMatters}
              onChange={(e) =>
                set('picCostingAndEstimationMatters', e.target.value)
              }
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="picImplementationStage"
              label="Implementation Stage"
              value={state.picImplementationStage}
              onChange={(e) => set('picImplementationStage', e.target.value)}
            />
          </HalfCol>
        </Row>
      ),
    },
    {
      label: 'ST/SP Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          <TextAreaField
            name="backgroundReview"
            label="Brief on the background of matters for review"
            value={state.backgroundReview}
            onChange={(e) => set('backgroundReview', e.target.value)}
            rows={4}
          />
          <TextAreaField
            name="scopeOfWorks"
            label="Scope of Works"
            value={state.scopeOfWorks}
            onChange={(e) => set('scopeOfWorks', e.target.value)}
            rows={4}
          />
          <TextAreaField
            name="keyTerms"
            label="Key Terms"
            value={state.keyTerms}
            onChange={(e) => set('keyTerms', e.target.value)}
            rows={4}
          />
          <RepeatableTextField
            label="Financial"
            value={state.financials}
            onChange={(v) => set('financials', v)}
          />
          <FileUpload
            label="Contract Structure Image"
            value={contractStructureFiles}
            onChange={setContractStructureFiles}
            uploader={contractStructureUploader}
          />
        </div>
      ),
    },
    {
      label: 'ST/SP Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          <TextAreaField
            name="technical"
            label="Technical (Competency, Specification and Delivery)"
            value={state.technical}
            onChange={(e) => set('technical', e.target.value)}
            rows={4}
          />
          <TextAreaField
            name="procurementStrategyWorkPackages"
            label="Procurement Strategy & Work Packages"
            value={state.procurementStrategyWorkPackages}
            onChange={(e) =>
              set('procurementStrategyWorkPackages', e.target.value)
            }
            rows={4}
          />
          <TextAreaField
            name="sourcingReference"
            label="Sourcing Reference"
            value={state.sourcingReference}
            onChange={(e) => set('sourcingReference', e.target.value)}
            rows={4}
          />
          <TextAreaField
            name="costBreakdown"
            label="Cost Breakdown"
            value={state.costBreakdown}
            onChange={(e) => set('costBreakdown', e.target.value)}
            rows={4}
          />
          <DynamicTableSection
            title="Risk Identification & Mitigation Plan"
            columns={[
              { key: 'risk', label: 'Risk', placeholder: 'Identified risk' },
              {
                key: 'mitigation',
                label: 'Mitigation',
                placeholder: 'Mitigation measure',
              },
            ]}
            value={parseTableData(state.riskIdentificationMitigationPlan)}
            onChange={(data) =>
              set('riskIdentificationMitigationPlan', JSON.stringify(data))
            }
          />
        </div>
      ),
    },
    {
      label: 'Document',
      render: () => (
        <Row className="g-3">
          <Col xs={12}>
            <FileUpload
              label="Attachments"
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
    setSubmitting(true);
    try {
      // Collect SharePoint links from completed uploads, tagged with their field.
      const uploadedAt = new Date().toISOString();
      const documents = [
        ...documentsFromUploads(
          contractStructureFiles.map((f) => ({
            name: f.file.name,
            url: f.url,
            id: f.remoteId,
          })),
          CONTRACT_STRUCTURE_FIELD,
          uploadedAt
        ),
        ...documentsFromUploads(
          attachments.map((f) => ({
            name: f.file.name,
            url: f.url,
            id: f.remoteId,
          })),
          null,
          uploadedAt
        ),
      ];

      const result = await submitStspRequest(state, {
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
    />
  );
};

export default StspForm;
export { StspForm };
