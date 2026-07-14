import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import CaaForm from './CaaForm';
import { loadCaaFormState, updateCaaRequestFromState } from './api';
import type { CaaFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for CAA requests. Resolves the matter, hydrates form state
 * from the loaded parent + child, and renders CaaForm in edit mode. The actual
 * PATCH is delegated through CaaForm's onEditSubmit so it carries the current
 * (possibly changed) form state.
 */
const CaaEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const caa = child.type === 'caa' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (caa ? loadCaaFormState(request, caa) : null),
    [request, caa]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !caa || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The CAA detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: CaaFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateCaaRequestFromState(state, {
      requestId: request.id,
      caaRecordId: caa.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <CaaForm
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

export default CaaEditForm;
export { CaaEditForm };
