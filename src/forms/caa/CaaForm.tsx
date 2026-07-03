import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import CurrencyField from '../CurrencyField';
import DateField from '../DateField';
import DynamicRowFields from '../DynamicRowFields';
import FileUpload from '../FileUpload';
import NumberField from '../NumberField';
import SelectField from '../SelectField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition } from '../multistep';
import type { RowFieldsData, UploadedFile } from '..';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import { requestCategoryChoices } from '../../data/requestChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitCaaRequest } from './api';
import type { CaaFormState } from './types';

/** Field key the org-chart upload is tagged with on gcp_documentsurl. */
const ORG_CHART_FIELD = 'projectOrgManpowerChart';

type CaaFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'caa:new';

const HalfCol = ({ children }: { children: ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

/**
 * Parse a stored DynamicRowFields JSON string back into `initialRows` so a
 * remounted step (MultiStepForm renders one step at a time) restores its rows.
 */
const parseRowFieldData = (
  value: string
): Record<string, string>[] | undefined => {
  if (!value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed as Record<string, unknown>)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (parsed as RowFieldsData)[Number(k)]);
    }
  } catch {
    // ignore — fall through to undefined
  }
  return undefined;
};

const CaaForm = ({ matter }: CaaFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: CaaFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    projectId: '',
    projectName: '',
    projectCode: '',

    tenderProposalPrice: '',
    finalContractAmount: '',
    estimatedBudgetCost: '',
    estimatedMargin: '',
    tenderProposalRefNo: '',
    letterOfAwardDate: '',
    contractCommencementDate: '',
    contractCompletionDate: '',
    contractPeriodDays: '',

    performanceBond: '',
    stampDuty: '',
    insurance: '',
    bumiputeraParticipation: '',
    formationOfJvCompany: '',
    criticalActivitiesMilestones: '',
    defectLiabilityPeriod: '',

    liquidatedDamagesRate: '',
    paymentTerm: '',
    typeOfContract: '',
    formOfContract: '',
    projectDirector: '',
    contactPersonAtSite: '',

    claimApplicationProcess: '',
    claimCertificationProcess: '',
    variationOrderApplicationProcess: '',

    extensionOfTimeApplicationProcess: '',
    commissioningCompletionSystems: '',
    keyDeliveryMilestone: '',

    mandatoryTesting: '',
    documentForContractualAcceptance: '',
    prerequisiteDocumentsForDlp: '',

    acknowledged: false,
  };

  const { state, setState, clearDraft } = useFormDraft<CaaFormState>(
    DRAFT_KEY,
    initial
  );
  const [isSubmitting, setSubmitting] = useState(false);

  // Project org & manpower chart upload. Files upload to SharePoint immediately
  // (via the uploader below); their links are persisted on the request's
  // gcp_documentsurl at submit. File objects can't be serialized into the draft,
  // so this lives in component state.
  const [orgChartFiles, setOrgChartFiles] = useState<UploadedFile[]>([]);

  // Last-step general attachments (field: null — belongs to the request itself).
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  // Stable draft id used to fold this request's uploads into one SharePoint
  // folder before the request record exists.
  const draftId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `draft-${Date.now().toString(36)}`,
    []
  );

  const orgChartUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'caa',
        requestId: draftId,
        fieldName: ORG_CHART_FIELD,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const attachmentsUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'caa',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof CaaFormState>(key: K, value: CaaFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

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

  // Load active projects for the step 1 project dropdown.
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

  // A titled, repeatable list persisted as a JSON string. Each row carries three
  // inputs (No. of days / Clause reference / Description); the section title is
  // the bold header, NOT an input placeholder. This is a render helper (NOT a
  // nested component) so DynamicRowFields keeps its identity across re-renders —
  // wrapping it in a component defined here would remount it on every keystroke
  // and drop focus / internal state.
  const renderRowList = (title: string, field: keyof CaaFormState) => (
    <DynamicRowFields
      title={title}
      fields={[
        { key: 'noOfDays', placeholder: 'No. of days', flex: 1 },
        { key: 'clauseReference', placeholder: 'Clause reference', flex: 3 },
        { key: 'description', placeholder: 'Description', flex: 3 },
      ]}
      initialRows={parseRowFieldData(state[field] as string)}
      onChange={(data) =>
        set(field, JSON.stringify(data) as CaaFormState[typeof field])
      }
    />
  );

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
              label="Company"
              options={
                user?.companyAccountId
                  ? [
                      {
                        label: user.company || 'Loading…',
                        value: user.companyAccountId,
                      },
                    ]
                  : []
              }
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
        if (!state.companyId) return 'Company is required.';
        if (!state.projectId) return 'Project is required.';
        return null;
      },
    },
    {
      label: 'Cost Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <CurrencyField
              label="Tender / Proposal Price"
              value={state.tenderProposalPrice}
              onChange={(v) => set('tenderProposalPrice', v)}
              helpText="Currency"
            />
          </HalfCol>
          <HalfCol>
            <CurrencyField
              label="Final Contract Amount"
              value={state.finalContractAmount}
              onChange={(v) => set('finalContractAmount', v)}
              helpText="Currency"
            />
          </HalfCol>
          <HalfCol>
            <CurrencyField
              label="Estimated Budget Cost"
              value={state.estimatedBudgetCost}
              onChange={(v) => set('estimatedBudgetCost', v)}
              helpText="Currency"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Estimated Margin %"
              value={state.estimatedMargin}
              onChange={(e) => set('estimatedMargin', e.target.value)}
              step="0.01"
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="tenderProposalRefNo"
              label="Tender / Proposal Ref. No."
              value={state.tenderProposalRefNo}
              onChange={(e) => set('tenderProposalRefNo', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="letterOfAwardDate"
              label="Letter of Award (LOA) Date"
              value={state.letterOfAwardDate}
              onChange={(e) => set('letterOfAwardDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="contractCommencementDate"
              label="Contract Commencement Date"
              value={state.contractCommencementDate}
              onChange={(e) => set('contractCommencementDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="contractCompletionDate"
              label="Contract Completion Date"
              value={state.contractCompletionDate}
              onChange={(e) => set('contractCompletionDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Contract Period (days)"
              value={state.contractPeriodDays}
              onChange={(e) => set('contractPeriodDays', e.target.value)}
              step="1"
            />
          </HalfCol>
        </Row>
      ),
    },
    {
      label: 'CAA Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="performanceBond"
              label="Performance Bond (PB) for Project"
              value={state.performanceBond}
              onChange={(e) => set('performanceBond', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Stamp Duty (Inclusive legal fees)"
              value={state.stampDuty}
              onChange={(e) => set('stampDuty', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="insurance"
              label="Insurance"
              value={state.insurance}
              onChange={(e) => set('insurance', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="bumiputeraParticipation"
              label="Bumiputera Participation"
              value={state.bumiputeraParticipation}
              onChange={(e) => set('bumiputeraParticipation', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="formationOfJvCompany"
              label="Formation of JV Company"
              value={state.formationOfJvCompany}
              onChange={(e) => set('formationOfJvCompany', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="criticalActivitiesMilestones"
              label="Critical Activities & Milestones"
              value={state.criticalActivitiesMilestones}
              onChange={(e) =>
                set('criticalActivitiesMilestones', e.target.value)
              }
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="defectLiabilityPeriod"
              label="Defect Liability Period (DLP)"
              value={state.defectLiabilityPeriod}
              onChange={(e) => set('defectLiabilityPeriod', e.target.value)}
            />
          </HalfCol>
          <Col xs={12}>
            <FileUpload
              label="Project Org & Manpower Chart"
              value={orgChartFiles}
              onChange={setOrgChartFiles}
              uploader={orgChartUploader}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: 'CAA Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <NumberField
              label="Liquidated Damages (LAD/day) Rate"
              value={state.liquidatedDamagesRate}
              onChange={(e) => set('liquidatedDamagesRate', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="paymentTerm"
              label="Payment Term"
              value={state.paymentTerm}
              onChange={(e) => set('paymentTerm', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="typeOfContract"
              label="Type of Contract"
              value={state.typeOfContract}
              onChange={(e) => set('typeOfContract', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="formOfContract"
              label="Form of Contract / Condition of Contract"
              value={state.formOfContract}
              onChange={(e) => set('formOfContract', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="projectDirector"
              label="Project Director (PD)"
              value={state.projectDirector}
              onChange={(e) => set('projectDirector', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="contactPersonAtSite"
              label="Contact Person at Site / Designation / Contact No."
              value={state.contactPersonAtSite}
              onChange={(e) => set('contactPersonAtSite', e.target.value)}
            />
          </HalfCol>
        </Row>
      ),
    },
    {
      label: 'CAA Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          {renderRowList(
            'Claim Management - Claim Application Process',
            'claimApplicationProcess'
          )}
          {renderRowList(
            'Claim Management - Claim Certification Process',
            'claimCertificationProcess'
          )}
          {renderRowList(
            'Change Management – Variation Order Application Process',
            'variationOrderApplicationProcess'
          )}
        </div>
      ),
    },
    {
      label: 'CAA Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          {renderRowList(
            'Change Management – Extension of Time Application Process',
            'extensionOfTimeApplicationProcess'
          )}
          {renderRowList(
            'Commissioning and Completion Management Systems',
            'commissioningCompletionSystems'
          )}
          {renderRowList('Key Delivery Milestone', 'keyDeliveryMilestone')}
        </div>
      ),
    },
    {
      label: 'CAA Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          {renderRowList(
            'Mandatory Testing required to commission',
            'mandatoryTesting'
          )}
          {renderRowList(
            'Document required for Contractual Acceptance (CPC)',
            'documentForContractualAcceptance'
          )}
          {renderRowList(
            'Pre requisite documents for completion of DLP',
            'prerequisiteDocumentsForDlp'
          )}
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
          orgChartFiles.map((f) => ({
            name: f.file.name,
            url: f.url,
            id: f.remoteId,
          })),
          ORG_CHART_FIELD,
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

      const result = await submitCaaRequest(state, {
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

export default CaaForm;
export { CaaForm };
