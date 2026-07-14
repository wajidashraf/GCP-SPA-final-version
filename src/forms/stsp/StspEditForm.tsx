import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import StspForm from './StspForm';
import { loadStspFormState, updateStspRequestFromState } from './api';
import type { StspFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for ST/SP requests. Resolves the matter, hydrates form
 * state from the loaded parent + child, and renders StspForm in edit mode. The
 * actual PATCH is delegated through StspForm's onEditSubmit so it carries the
 * current (possibly changed) form state.
 */
const StspEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const stsp = child.type === 'stsp' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (stsp ? loadStspFormState(request, stsp) : null),
    [request, stsp]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !stsp || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The ST/SP detail record for this request couldn’t be loaded, so it
        can’t be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: StspFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateStspRequestFromState(state, {
      requestId: request.id,
      stspRecordId: stsp.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <StspForm
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

export default StspEditForm;
export { StspEditForm };
