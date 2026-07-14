import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import CiForm from './CiForm';
import { loadCiFormState, updateCiRequestFromState } from './api';
import type { CiFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for CI (Contractual Issue) requests. Resolves the matter,
 * hydrates form state from the loaded parent + child, and renders CiForm in edit
 * mode. The actual PATCH is delegated through CiForm's onEditSubmit so it
 * carries the current (possibly changed) form state.
 */
const CiEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const ci = child.type === 'ci' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (ci ? loadCiFormState(request, ci) : null),
    [request, ci]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !ci || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The CI detail record for this request couldn’t be loaded, so it can’t be
        edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: CiFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateCiRequestFromState(state, {
      requestId: request.id,
      ciRecordId: ci.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <CiForm
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

export default CiEditForm;
export { CiEditForm };
