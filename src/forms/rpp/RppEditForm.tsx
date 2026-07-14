import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import RppForm from './RppForm';
import { loadRppFormState, updateRppRequestFromState } from './api';
import type { RppFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for R-PP (Revised Procurement Plan) requests. Resolves the
 * matter, hydrates form state from the loaded parent + child, and renders RppForm
 * in edit mode. The actual PATCH is delegated through RppForm's onEditSubmit so
 * it carries the current (possibly changed) form state.
 */
const RppEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const rpp = child.type === 'rpp' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (rpp ? loadRppFormState(request, rpp) : null),
    [request, rpp]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !rpp || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The Revised PP detail record for this request couldn’t be loaded, so it
        can’t be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: RppFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateRppRequestFromState(state, {
      requestId: request.id,
      rppRecordId: rpp.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <RppForm
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

export default RppEditForm;
export { RppEditForm };
