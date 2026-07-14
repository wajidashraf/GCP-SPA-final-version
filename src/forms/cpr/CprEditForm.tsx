import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import CprForm from './CprForm';
import { loadCprFormState, updateCprRequestFromState } from './api';
import type { CprFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for CPR (Contract Progress Report) requests. Resolves the
 * matter, hydrates form state from the loaded parent + child, and renders CprForm
 * in edit mode. The actual PATCH is delegated through CprForm's onEditSubmit so
 * it carries the current (possibly changed) form state.
 */
const CprEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const cpr = child.type === 'cpr' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (cpr ? loadCprFormState(request, cpr) : null),
    [request, cpr]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !cpr || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The CPR detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: CprFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateCprRequestFromState(state, {
      requestId: request.id,
      cprRecordId: cpr.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <CprForm
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

export default CprEditForm;
export { CprEditForm };
