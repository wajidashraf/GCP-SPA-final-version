import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import PccaForm from './PccaForm';
import { loadPccaFormState, updatePccaRequestFromState } from './api';
import type { PccaFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for PCCA (Project Cost Control Analysis) requests. Resolves
 * the matter, hydrates form state from the loaded parent + child, and renders
 * PccaForm in edit mode. The actual PATCH is delegated through PccaForm's
 * onEditSubmit so it carries the current (possibly changed) form state.
 */
const PccaEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const pcca = child.type === 'pcca' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (pcca ? loadPccaFormState(request, pcca) : null),
    [request, pcca]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !pcca || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The PCCA detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: PccaFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updatePccaRequestFromState(state, {
      requestId: request.id,
      pccaRecordId: pcca.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <PccaForm
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

export default PccaEditForm;
export { PccaEditForm };
