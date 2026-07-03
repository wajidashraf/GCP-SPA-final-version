import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import RtpForm from './RtpForm';
import { loadRtpFormState, updateRtpRequestFromState } from './api';
import type { RtpFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for RTP requests. Resolves the matter, hydrates form state
 * from the loaded parent + child, and renders RtpForm in edit mode. The actual
 * PATCH is delegated through RtpForm's onEditSubmit so it carries the current
 * (possibly changed) form state.
 */
const RtpEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const rtp = child.type === 'rtp' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (rtp ? loadRtpFormState(request, rtp) : null),
    [request, rtp]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !rtp || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The RTP detail record for this request couldn’t be loaded, so it can’t be
        edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: RtpFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateRtpRequestFromState(state, {
      requestId: request.id,
      rtpRecordId: rtp.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <RtpForm
      matter={matter}
      mode="edit"
      initialState={initialState}
      requestId={request.id}
      initialDocuments={initialDocuments}
      onEditSubmit={handleEditSubmit}
      onEditSuccess={onSaved}
    />
  );
};

export default RtpEditForm;
export { RtpEditForm };
