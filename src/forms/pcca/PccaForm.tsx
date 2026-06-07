import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import FileUpload from '../FileUpload';
import type { UploadedFile } from '../FileUpload';
import DynamicRowFields from '../DynamicRowFields';
import NumberField from '../NumberField';
import SelectField from '../SelectField';
import TextAreaField from '../TextAreaField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition } from '../multistep';
import type { RowFieldsData } from '..';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import { requestCategoryChoices } from '../../data/requestChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitPccaRequest } from './api';
import type { PccaFormState } from './types';

type PccaFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'pcca:new';

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

/** Sum a numeric column across all rows of a stored DynamicRowFields JSON string. */
const sumRowField = (value: string, key: string): number => {
  if (!value.trim()) return 0;
  try {
    const parsed = JSON.parse(value) as Record<string, Record<string, string>>;
    return Object.values(parsed).reduce((acc, row) => {
      const raw = String(row?.[key] ?? '').replace(/,/g, '').trim();
      const n = Number(raw);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  } catch {
    return 0;
  }
};

const PccaForm = ({ matter }: PccaFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: PccaFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    projectId: '',
    projectName: '',
    projectCode: '',

    priceRevenueFromContractBq: '',
    costFromContractBq: '',

    totalRevenue: '',
    totalCost: '',
    constructionCost: '',
    internalCost: '',
    remarks: '',

    acknowledged: false,
  };

  const { state, setState, clearDraft } = useFormDraft<PccaFormState>(
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
        entityType: 'pcca',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof PccaFormState>(key: K, value: PccaFormState[K]) =>
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

  // Auto-sum the two BQ sections into the read-only Cost Summary totals.
  const totalRevenue = useMemo(
    () => sumRowField(state.priceRevenueFromContractBq, 'priceRevenue'),
    [state.priceRevenueFromContractBq]
  );
  const totalCost = useMemo(
    () => sumRowField(state.costFromContractBq, 'cost'),
    [state.costFromContractBq]
  );

  useEffect(() => {
    const rev = String(Math.round(totalRevenue));
    const cost = String(Math.round(totalCost));
    setState((prev) =>
      prev.totalRevenue === rev && prev.totalCost === cost
        ? prev
        : { ...prev, totalRevenue: rev, totalCost: cost }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRevenue, totalCost]);

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
      label: 'Cost Information',
      render: () => (
        <div className="d-flex flex-column gap-3">
          <DynamicRowFields
            title="Price/Revenue (from Contract BQ)"
            fields={[
              { key: 'workDescription', placeholder: 'Work Description (BQ)', flex: 3 },
              { key: 'priceRevenue', placeholder: 'Price/Revenue (RM)', flex: 2 },
            ]}
            initialRows={parseRowFieldData(state.priceRevenueFromContractBq)}
            onChange={(data) =>
              set('priceRevenueFromContractBq', JSON.stringify(data))
            }
          />
          <DynamicRowFields
            title="Cost (from Contract BQ)"
            fields={[
              { key: 'workDescription', placeholder: 'Work Description (BQ)', flex: 3 },
              { key: 'cost', placeholder: 'Cost (RM)', flex: 2 },
            ]}
            initialRows={parseRowFieldData(state.costFromContractBq)}
            onChange={(data) => set('costFromContractBq', JSON.stringify(data))}
          />
        </div>
      ),
    },
    {
      label: 'Cost Summary',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <NumberField
              label="Total Revenue (RM)"
              value={state.totalRevenue}
              isReadOnly
              helpText="Auto-summed from Price/Revenue (RM) in Cost Information."
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Total Cost (RM)"
              value={state.totalCost}
              isReadOnly
              helpText="Auto-summed from Cost (RM) in Cost Information."
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Construction Cost (RM)"
              value={state.constructionCost}
              onChange={(e) => set('constructionCost', e.target.value)}
              step="1"
            />
          </HalfCol>
          <HalfCol>
            <NumberField
              label="Internal Cost"
              value={state.internalCost}
              onChange={(e) => set('internalCost', e.target.value)}
              step="1"
            />
          </HalfCol>
          <Col xs={12}>
            <TextAreaField
              name="remarks"
              label="Remarks"
              value={state.remarks}
              onChange={(e) => set('remarks', e.target.value)}
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

      const result = await submitPccaRequest(state, {
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

export default PccaForm;
export { PccaForm };
