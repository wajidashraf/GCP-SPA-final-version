import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import OthersForm from './OthersForm';
import { loadOthersFormState, updateOtherRequestFromState } from './api';
import type { OthersFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for "Others" requests (shared by GCPC matter 9 and GCP
 * matter 13). Resolves the matter, hydrates form state from the loaded parent +
 * child, and renders OthersForm in edit mode. The actual PATCH is delegated
 * through OthersForm's onEditSubmit so it carries the current form state.
 */
const OthersEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const other = child.type === 'other' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (other ? loadOthersFormState(request, other) : null),
    [request, other]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !other || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The detail record for this request couldn’t be loaded, so it can’t be
        edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: OthersFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateOtherRequestFromState(state, {
      requestId: request.id,
      otherRecordId: other.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <OthersForm
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

export default OthersEditForm;
export { OthersEditForm };
