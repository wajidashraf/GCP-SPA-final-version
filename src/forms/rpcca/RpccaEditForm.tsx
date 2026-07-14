import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import RpccaForm from './RpccaForm';
import { loadRpccaFormState, updateRpccaRequestFromState } from './api';
import type { RpccaFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for R-PCCA (Revised Project Cost Control Analysis) requests.
 * Resolves the matter, hydrates form state from the loaded parent + child, and
 * renders RpccaForm in edit mode. The actual PATCH is delegated through
 * RpccaForm's onEditSubmit so it carries the current (possibly changed) state.
 */
const RpccaEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const rpcca = child.type === 'rpcca' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (rpcca ? loadRpccaFormState(request, rpcca) : null),
    [request, rpcca]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !rpcca || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The Revised PCCA detail record for this request couldn’t be loaded, so
        it can’t be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: RpccaFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateRpccaRequestFromState(state, {
      requestId: request.id,
      rpccaRecordId: rpcca.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <RpccaForm
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

export default RpccaEditForm;
export { RpccaEditForm };
