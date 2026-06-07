import { useEffect, useMemo, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CheckboxField from '../CheckboxField';
import DateField from '../DateField';
import FileUpload from '../FileUpload';
import type { UploadedFile } from '../FileUpload';
import SelectField from '../SelectField';
import TextAreaField from '../TextAreaField';
import TextField from '../TextField';
import { MultiStepForm, useFormDraft } from '../multistep';
import type { StepDefinition } from '../multistep';
import { useAuth } from '../../context/AuthContext';
import { matterChoices, type MatterChoice } from '../../data/matterChoices';
import {
  registrationTypeChoices,
  requestCategoryChoices,
} from '../../data/requestChoices';
import { toSelectOptions } from '../../data/types';
import { makeSharePointUploader } from '../../shared/uploadApi';
import { documentsFromUploads } from '../../shared/documents';
import { sendRequestNotification } from '../../shared/notificationApi';
import { submitRtpRequest } from './api';
import type { RtpFormState } from './types';

type RtpFormProps = { matter: MatterChoice };

const DRAFT_KEY = 'rtp:new';

const HalfCol = ({ children }: { children: React.ReactNode }) => (
  <Col xs={12} md={6}>
    {children}
  </Col>
);

const RtpForm = ({ matter }: RtpFormProps) => {
  const { user } = useAuth();

  const defaultCategoryValue = useMemo(() => {
    const code = matter.channel.toUpperCase();
    return requestCategoryChoices.find((c) => c.label === code)?.value ?? 2;
  }, [matter.channel]);

  const initial: RtpFormState = {
    matterValue: matter.value,
    categoryValue: defaultCategoryValue,
    requestorContactId: user?.email ?? '',
    requestorName: user?.name ?? '',
    requestorEmail: user?.email ?? '',
    companyId: '',
    clientName: '',
    registrationType: '',
    tenderClosingDate: '',
    projectName: '',
    projectDescription: '',
    acknowledged: false,
    specialProjectFlag: false,
  };

  const { state, setState, clearDraft } = useFormDraft<RtpFormState>(
    DRAFT_KEY,
    initial
  );
  const [isSubmitting, setSubmitting] = useState(false);
  // Files chosen on the last step. Not persisted to draft (File objects aren't
  // serializable). Upload to SharePoint immediately; because they're added on
  // the final step they belong to the request itself (field: null).
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
        entityType: 'rtp',
        requestId: draftId,
        loginHint: user?.email,
      }),
    [draftId, user?.email]
  );

  const set = <K extends keyof RtpFormState>(key: K, value: RtpFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Sync the lookup binding to the logged-in user's parent account (resolved
  // by AuthContext via the contact's parentcustomerid). The field is shown as
  // read-only display text driven by `user.company`.
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

  const matterOptions = useMemo(
    () => toSelectOptions(matterChoices.map((m) => ({ label: m.label, value: m.value }))),
    []
  );
  const categoryOptions = useMemo(() => toSelectOptions(requestCategoryChoices), []);
  const requestorOptions = user
    ? [{ label: user.name, value: user.email }]
    : [];
  const registrationOptions = useMemo(
    () => toSelectOptions(registrationTypeChoices),
    []
  );

  const steps: StepDefinition[] = [
    {
      label: 'Basics Information',
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
        if (!state.requestorEmail.trim()) return 'Requestor email is required.';
        if (!state.companyId) return 'Company is required.';
        return null;
      },
    },
    {
      label: 'Project Details',
      render: () => (
        <Row className="g-3">
          <HalfCol>
            <TextField
              name="clientName"
              label="Client Name"
              value={state.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              isRequired
            />
          </HalfCol>
           <HalfCol>
            <TextField
              name="projectName"
              label="Project Name"
              value={state.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              isRequired
            />
          </HalfCol>
          <HalfCol>
            <SelectField
              name="registrationType"
              label="Registration Type"
              options={registrationOptions}
              value={state.registrationType === '' ? '' : String(state.registrationType)}
              onChange={(e) =>
                set(
                  'registrationType',
                  e.target.value === ''
                    ? ''
                    : (Number(e.target.value) as RtpFormState['registrationType'])
                )
              }
              isRequired
            />
          </HalfCol>
          <HalfCol>
            <DateField
              name="tenderClosingDate"
              label="Tender Closing Date"
              value={state.tenderClosingDate}
              onChange={(e) => set('tenderClosingDate', e.target.value)}
              isRequired
            />
          </HalfCol>
         
          <Col xs={12}>
            <TextAreaField
              name="projectDescription"
              label="Project Description"
              value={state.projectDescription}
              placeholder="Provide a brief description of the project, including scope, objectives, and any relevant background information."
              onChange={(e) => set('projectDescription', e.target.value)}
              rows={4}
              isRequired
            />
          </Col>
        </Row>
      ),
      validate: () => {
        if (!state.clientName.trim()) return 'Client name is required.';
        if (state.registrationType === '') return 'Registration type is required.';
        if (!state.tenderClosingDate) return 'Tender closing date is required.';
        if (!state.projectName.trim()) return 'Project name is required.';
        if (!state.projectDescription.trim())
          return 'Project description is required.';
        return null;
      },
    },
    {
      label: 'Document',
      render: () => (
        <Row className="g-3">
          <Col xs={12}>
            <CheckboxField
              name="acknowledged"
              label="I confirm the information provided is accurate."
              checked={state.acknowledged}
              onChange={(e) => set('acknowledged', e.target.checked)}
              isRequired
            />
          </Col>
          <Col xs={12}>
            <CheckboxField
              name="specialProjectFlag"
              label="Mark this as a special project."
              checked={state.specialProjectFlag}
              onChange={(e) => set('specialProjectFlag', e.target.checked)}
              helpText="Tick if this RTP request requires special handling."
            />
          </Col>
          <Col xs={12}>
            <FileUpload
              label="Attachments"
              value={attachments}
              onChange={setAttachments}
              uploader={attachmentsUploader}
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
      // Last-step attachments belong to the request itself (field: null).
      const documents = documentsFromUploads(
        attachments.map((f) => ({
          name: f.file.name,
          url: f.url,
          id: f.remoteId,
        })),
        null,
        new Date().toISOString()
      );

      const result = await submitRtpRequest(state, {
        requestorContactId: user?.contactId ?? null,
        documents,
      });

      clearDraft();

      // Fire-and-forget: notify the requester + all Verifiers. A failure here
      // must not block the submission — we only choose which toast to show.
      const emailSent = await sendRequestNotification(
        {
          recordId: result.requestId,
          requestName: state.projectName || matter.label,
          requestType: 'RTP',
          submissionDate: new Date().toISOString(),
        },
        user?.email
      );

      return {
        reference: result.requestId,
        toast: emailSent
          ? {
              message: 'Request submitted successfully. Notification email sent.',
              tone: 'success' as const,
            }
          : {
              message:
                'Request submitted successfully — notification email could not be sent.',
              tone: 'error' as const,
            },
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

export default RtpForm;
export { RtpForm };
