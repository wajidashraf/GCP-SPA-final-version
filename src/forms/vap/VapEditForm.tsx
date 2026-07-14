import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import VapForm from './VapForm';
import { loadVapFormState, updateVapRequestFromState } from './api';
import type { VapFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for VAP (Vendor Appointment & Procurement) requests.
 * Resolves the matter, hydrates form state from the loaded parent + child, and
 * renders VapForm in edit mode. The actual PATCH is delegated through VapForm's
 * onEditSubmit so it carries the current (possibly changed) form state.
 */
const VapEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const vap = child.type === 'vap' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (vap ? loadVapFormState(request, vap) : null),
    [request, vap]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !vap || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The VAP detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: VapFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateVapRequestFromState(state, {
      requestId: request.id,
      vapRecordId: vap.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <VapForm
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

export default VapEditForm;
export { VapEditForm };
