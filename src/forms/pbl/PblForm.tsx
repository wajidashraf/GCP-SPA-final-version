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
import type { StepDefinition } from '../multistep';
import { useAuth } from '../../context/AuthContext';
import { notifyEvent } from '../../shared/notificationApi';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import {
  procurementMethodChoices,
  requestCategoryChoices,
} from '../../data/requestChoices';
import { sectorChoices, type SectorValue } from '../../data/projectChoices';
import { toSelectOptions } from '../../data/types';
import { listActiveProjects } from '../../shared/services/projectService';
import { useAccounts } from '../../shared/hooks/useAccount';
import { ACCOUNTS_WITH_CODE_AND_SECTOR_FILTER } from '../../shared/services/accountService';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import type { GcpProject } from '../../types/project';
import { submitPblRequest } from './api';
import { emptyBidderDraft } from './types';
import type { PblFormState } from './types';

const OTHER_COMPANY_VALUE = '__other__';
const EXCLUDED_COMPANY_NAME = 'OBYU Realty Sdn Bhd';

type PblFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'pbl:new';

const HalfCol = ({ children }: { children: ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

const PblForm = ({ matter }: PblFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: PblFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    projectId: '',
    projectName: '',
    projectCode: '',
    procurementMethod: '',
    bidders: [],
    justificationForLessBidders: '',
    acknowledged: false,
  };

  const { state, setState, clearDraft } = useFormDraft<PblFormState>(
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
        entityType: 'pbl',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof PblFormState>(
    key: K,
    value: PblFormState[K]
  ) => setState((prev) => ({ ...prev, [key]: value }));

  // Sync company lookup to logged-in user's parent account
  useEffect(() => {
    if (!user?.companyAccountId) return;
    if (state.companyId === user.companyAccountId) return;
    setState((prev) => ({ ...prev, companyId: user.companyAccountId ?? '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyAccountId]);

  // Sync requestor name + email when AuthContext hydrates (draft persists across
  // sessions and may have stale '' values from before login resolved).
  useEffect(() => {
    if (!user?.email) return;
    setState((prev) => {
      if (prev.requestorEmail === user.email && prev.requestorName === user.name) {
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

  // Load companies (Accounts) for the bidder Company dropdown on step 3.
  // Only accounts that have both a company code and a sector value; the user's
  // own company (OBYU Realty Sdn Bhd) is then excluded by name match below.
  const { items: accounts, isLoading: accountsLoading } = useAccounts({
    pageSize: 200,
    orderby: 'name asc',
    filter: ACCOUNTS_WITH_CODE_AND_SECTOR_FILTER,
  });
  const bidderCompanyAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => (a.name || '').trim() !== EXCLUDED_COMPANY_NAME
      ),
    [accounts]
  );

  // Load active projects for step 2
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

  // Memo lookups
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
  const procurementOptions = useMemo(
    () => toSelectOptions(procurementMethodChoices),
    []
  );
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        label: p.name || p.code || p.id,
        value: p.id,
      })),
    [projects]
  );

  // Bidder draft state (step 3)
  const [bidderDraft, setBidderDraft] = useState(emptyBidderDraft());
  const setBidder = <K extends keyof typeof bidderDraft>(
    k: K,
    v: (typeof bidderDraft)[K]
  ) => setBidderDraft((p) => ({ ...p, [k]: v }));

  const canAddBidder = () => {
    if (bidderDraft.isOtherCompany) return bidderDraft.companyName.trim().length > 0;
    return bidderDraft.companyAccountId !== '';
  };
  const addBidder = () => {
    if (!canAddBidder()) return;
    setState((prev) => ({
      ...prev,
      bidders: [...prev.bidders, bidderDraft],
    }));
    setBidderDraft(emptyBidderDraft());
  };
  const removeBidder = (index: number) =>
    setState((prev) => ({
      ...prev,
      bidders: prev.bidders.filter((_, i) => i !== index),
    }));

  const onProjectSelect = (id: string) => {
    const project = projects.find((p) => p.id === id);
    setState((prev) => ({
      ...prev,
      projectId: id,
      projectName: project?.name ?? '',
      projectCode: project?.code ?? '',
    }));
  };

  const shouldRequireJustification = state.bidders.length < 3;

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
        return null;
      },
    },
    {
      label: 'Project details',
      render: () => (
        <Row className="g-3">
          {projectsError ? (
            <Col xs={12}>
              <div className="alert alert-danger">{projectsError}</div>
            </Col>
          ) : null}
          <HalfCol>
            <SelectField
              name="project"
              label="Project"
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
              name="procurementMethod"
              label="Procurement Method"
              options={procurementOptions}
              value={
                state.procurementMethod === ''
                  ? ''
                  : String(state.procurementMethod)
              }
              onChange={(e) =>
                set(
                  'procurementMethod',
                  e.target.value === ''
                    ? ''
                    : (Number(
                        e.target.value
                      ) as PblFormState['procurementMethod'])
                )
              }
              isRequired
            />
          </HalfCol>
        </Row>
      ),
      validate: () => {
        if (!state.projectId) return 'Project is required.';
        if (state.procurementMethod === '')
          return 'Procurement method is required.';
        return null;
      },
    },
    {
      label: 'Bidders',
      description: 'Add bidder records',
      render: () => (
        <div className="d-flex flex-column gap-4">
          <div className="border rounded p-3">
            <p className="fw-semibold mb-3">Add a bidder</p>
            <Row className="g-3">
              <HalfCol>
                <SelectField
                  name="bidderCompanyAccount"
                  label="Company"
                  options={[
                    ...bidderCompanyAccounts.map((a) => ({
                      label: a.name || a.accountNumber || a.accountId,
                      value: a.accountId,
                    })),
                    { label: 'Other', value: OTHER_COMPANY_VALUE },
                  ]}
                  value={
                    bidderDraft.isOtherCompany
                      ? OTHER_COMPANY_VALUE
                      : bidderDraft.companyAccountId
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === OTHER_COMPANY_VALUE) {
                      setBidderDraft((prev) => ({
                        ...prev,
                        isOtherCompany: true,
                        companyAccountId: '',
                        companyName: '',
                        sector: '',
                      }));
                    } else {
                      const acc = bidderCompanyAccounts.find(
                        (a) => a.accountId === v
                      );
                      setBidderDraft((prev) => ({
                        ...prev,
                        isOtherCompany: false,
                        companyAccountId: v,
                        companyName: acc?.name ?? '',
                        sector:
                          (acc?.sector as SectorValue | null | undefined) ??
                          '',
                      }));
                    }
                  }}
                  placeholder={
                    accountsLoading ? 'Loading companies…' : 'Select a company'
                  }
                />
              </HalfCol>
              {bidderDraft.isOtherCompany ? (
                <HalfCol>
                  <TextField
                    name="bidderCompanyNameOther"
                    label="Enter Company Name"
                    value={bidderDraft.companyName}
                    onChange={(e) => setBidder('companyName', e.target.value)}
                    isRequired
                  />
                </HalfCol>
              ) : null}
              <HalfCol>
                <SelectField
                  name="bidderSector"
                  label="Sector"
                  options={toSelectOptions(sectorChoices)}
                  value={
                    bidderDraft.sector === '' ? '' : String(bidderDraft.sector)
                  }
                  onChange={(e) =>
                    setBidder(
                      'sector',
                      e.target.value === ''
                        ? ''
                        : (Number(e.target.value) as SectorValue)
                    )
                  }
                  isReadOnly={!bidderDraft.isOtherCompany}
                />
              </HalfCol>
              <HalfCol>
                <TextField
                  name="bidderLocation"
                  label="Location"
                  value={bidderDraft.location}
                  onChange={(e) => setBidder('location', e.target.value)}
                />
              </HalfCol>
              <HalfCol>
                <TextField
                  name="bidderPic"
                  label="Person In Charge"
                  value={bidderDraft.personInCharge}
                  onChange={(e) => setBidder('personInCharge', e.target.value)}
                />
              </HalfCol>
              <HalfCol>
                <TextField
                  name="bidderPicContact"
                  label="PIC Contact Number"
                  value={bidderDraft.picContactNumber}
                  onChange={(e) =>
                    setBidder('picContactNumber', e.target.value)
                  }
                />
              </HalfCol>
              <HalfCol>
                <TextField
                  name="bidderSourcesFrom"
                  label="Sources From"
                  value={bidderDraft.sourcesFrom}
                  onChange={(e) => setBidder('sourcesFrom', e.target.value)}
                />
              </HalfCol>
              <HalfCol>
                <TextField
                  name="bidderRecommendation"
                  label="Recommendation By"
                  value={bidderDraft.recommendationBy}
                  onChange={(e) =>
                    setBidder('recommendationBy', e.target.value)
                  }
                />
              </HalfCol>
              <Col xs={12} className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={addBidder}
                  disabled={!canAddBidder()}
                >
                  + Add Bidder
                </button>
              </Col>
            </Row>
          </div>

          <div className="border rounded">
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
              <p className="fw-semibold mb-0">Bidders List</p>
              <span className="badge bg-info text-dark">
                {state.bidders.length} item
                {state.bidders.length === 1 ? '' : 's'}
              </span>
            </div>
            {state.bidders.length === 0 ? (
              <div className="p-3 text-muted">
                No bidder records added yet. Add at least one bidder to
                continue.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-top">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Company</th>
                      <th>Location</th>
                      <th>PIC</th>
                      <th>PIC Contact</th>
                      <th>Sources</th>
                      <th>Recommended By</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.bidders.map((b, i) => (
                      <tr key={`${b.companyName}-${i}`}>
                        <td>{i + 1}</td>
                        <td>{b.companyName}</td>
                        <td>{b.location || '—'}</td>
                        <td>{b.personInCharge || '—'}</td>
                        <td>{b.picContactNumber || '—'}</td>
                        <td>{b.sourcesFrom || '—'}</td>
                        <td>{b.recommendationBy || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0"
                            onClick={() => removeBidder(i)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {shouldRequireJustification ? (
            <TextAreaField
              name="justificationForLessBidders"
              label="Justification for less than 3 bidders"
              value={state.justificationForLessBidders}
              onChange={(e) =>
                set('justificationForLessBidders', e.target.value)
              }
              rows={4}
              isRequired
              helpText="Required when fewer than 3 bidders are added."
            />
          ) : null}
        </div>
      ),
      validate: () => {
        if (state.bidders.length === 0)
          return 'Add at least one bidder to continue.';
        if (
          shouldRequireJustification &&
          !state.justificationForLessBidders.trim()
        ) {
          return 'Justification is required when fewer than 3 bidders are added.';
        }
        return null;
      },
    },
    {
      label: 'Document',
      description: 'Acknowledge & submit',
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
              label="I confirm the information provided is accurate."
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

      const result = await submitPblRequest(state, {
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

export default PblForm;
export { PblForm };
