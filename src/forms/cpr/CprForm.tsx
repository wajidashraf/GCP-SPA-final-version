import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import DateField from '../DateField';
import FileUpload from '../FileUpload';
import type { UploadedFile } from '../FileUpload';
import NumberField from '../NumberField';
import SelectField from '../SelectField';
import TextAreaField from '../TextAreaField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition } from '../multistep';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import { requestCategoryChoices } from '../../data/requestChoices';
import {
  cprApplicationStatusChoices,
  type CprApplicationStatusValue,
} from '../../data/cprChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitCprRequest } from './api';
import type { CprFormState } from './types';

type CprFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'cpr:new';

const HalfCol = ({ children }: { children: ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

const CprForm = ({ matter }: CprFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: CprFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    projectId: '',
    projectName: '',
    projectCode: '',

    eotLatestNo: '',
    eotLatestDate: '',
    eotNewApplicationDate: '',
    eotNewCompletionDate: '',
    eotStatus: 1, // Active
    eotNewJustifications: '',

    voLatestNo: '',
    voLatestApprovedCumulativeAmount: '',
    voNewApplicationAmount: '',
    voNewApplicationNo: '',
    voNewApplicationDate: '',
    voStatus: 2, // Inactive
    voNewJustification: '',

    cumulativeClaimApplicationAmount: '',
    cumulativeClaimCertifiedAmount: '',
    pendingCertifiedAmount: '',
    noOfClaimsForPendingCertified: '',
    newNetCertifiedAmount: '',
    dateOfClaimPendingCertified: '',

    acknowledged: false,
  };

  const { state, setState, clearDraft } = useFormDraft<CprFormState>(
    DRAFT_KEY,
    initial
  );
  const [isSubmitting, setSubmitting] = useState(false);

  // Request-level attachments added on the final step. File objects can't be
  // serialized into the draft, so this lives in component state; their
  // SharePoint links are persisted on gcp_documentsurl at submit (field: null).
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

  const attachmentsUploader = useMemo(
    () =>
      makeSharePointUploader({
        entityType: 'cpr',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof CprFormState>(key: K, value: CprFormState[K]) =>
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
  const statusOptions = useMemo(
    () => toSelectOptions(cprApplicationStatusChoices),
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
              label="Company Name"
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
      label: 'EOT Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="eotLatestNo"
              label="EOT Latest No."
              value={state.eotLatestNo}
              onChange={(e) => set('eotLatestNo', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="eotLatestDate"
              label="EOT Latest Date"
              value={state.eotLatestDate}
              onChange={(e) => set('eotLatestDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="eotNewApplicationDate"
              label="EOT New Application Date"
              value={state.eotNewApplicationDate}
              onChange={(e) => set('eotNewApplicationDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="eotNewCompletionDate"
              label="EOT New Completion Date"
              value={state.eotNewCompletionDate}
              onChange={(e) => set('eotNewCompletionDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="eotStatus"
              label="Status of New EOT Application"
              options={statusOptions}
              value={String(state.eotStatus)}
              onChange={(e) =>
                set('eotStatus', Number(e.target.value) as CprApplicationStatusValue)
              }
            />
          </HalfCol>
          <Col xs={12}>
            <TextAreaField
              name="eotNewJustifications"
              label="EOT New Justifications"
              value={state.eotNewJustifications}
              onChange={(e) => set('eotNewJustifications', e.target.value)}
              rows={3}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: 'VO Information',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="voLatestNo"
              label="VO Latest No."
              value={state.voLatestNo}
              onChange={(e) => set('voLatestNo', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Latest Approved VO Cumulative Amount"
              value={state.voLatestApprovedCumulativeAmount}
              onChange={(e) =>
                set('voLatestApprovedCumulativeAmount', e.target.value)
              }
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="New VO Application Amount"
              value={state.voNewApplicationAmount}
              onChange={(e) => set('voNewApplicationAmount', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <TextField
              name="voNewApplicationNo"
              label="VO New Application No."
              value={state.voNewApplicationNo}
              onChange={(e) => set('voNewApplicationNo', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="voNewApplicationDate"
              label="VO New Application Date"
              value={state.voNewApplicationDate}
              onChange={(e) => set('voNewApplicationDate', e.target.value)}
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="voStatus"
              label="Status of New VO Application"
              options={statusOptions}
              value={String(state.voStatus)}
              onChange={(e) =>
                set('voStatus', Number(e.target.value) as CprApplicationStatusValue)
              }
            />
          </HalfCol>
          <Col xs={12}>
            <TextAreaField
              name="voNewJustification"
              label="VO New Justification"
              value={state.voNewJustification}
              onChange={(e) => set('voNewJustification', e.target.value)}
              rows={3}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: 'Claims to Client',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <NumberField
              label="Cumulative Claim Application Amount to Date"
              value={state.cumulativeClaimApplicationAmount}
              onChange={(e) =>
                set('cumulativeClaimApplicationAmount', e.target.value)
              }
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Cumulative Claim Certified Amount to Date"
              value={state.cumulativeClaimCertifiedAmount}
              onChange={(e) =>
                set('cumulativeClaimCertifiedAmount', e.target.value)
              }
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Pending Certified Amount to Date"
              value={state.pendingCertifiedAmount}
              onChange={(e) => set('pendingCertifiedAmount', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="No. of Claims for Pending Certified Amount"
              value={state.noOfClaimsForPendingCertified}
              onChange={(e) =>
                set('noOfClaimsForPendingCertified', e.target.value)
              }
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="New Net Certified Amount"
              value={state.newNetCertifiedAmount}
              onChange={(e) => set('newNetCertifiedAmount', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="dateOfClaimPendingCertified"
              label="Date of Claim Pending Certified Amount"
              value={state.dateOfClaimPendingCertified}
              onChange={(e) =>
                set('dateOfClaimPendingCertified', e.target.value)
              }
            />
          </HalfCol>
        </Row>
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

      const result = await submitCprRequest(state, {
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

export default CprForm;
export { CprForm };
