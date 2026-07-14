import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import PpForm from './PpForm';
import { loadPpFormState, updatePpRequestFromState } from './api';
import type { PpFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for PP (Procurement Plan) requests. Resolves the matter,
 * hydrates form state from the loaded parent + child, and renders PpForm in edit
 * mode. The actual PATCH is delegated through PpForm's onEditSubmit so it carries
 * the current (possibly changed) form state.
 */
const PpEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const pp = child.type === 'pp' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (pp ? loadPpFormState(request, pp) : null),
    [request, pp]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !pp || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The PP detail record for this request couldn’t be loaded, so it can’t be
        edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: PpFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updatePpRequestFromState(state, {
      requestId: request.id,
      ppRecordId: pp.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <PpForm
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

export default PpEditForm;
export { PpEditForm };
