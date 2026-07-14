import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import JvpForm from './JvpForm';
import { loadJvpFormState, updateJvpRequestFromState } from './api';
import type { JvpFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for JVP requests. Resolves the matter, hydrates form state
 * from the loaded parent + child, and renders JvpForm in edit mode. The actual
 * PATCH is delegated through JvpForm's onEditSubmit so it carries the current
 * (possibly changed) form state.
 */
const JvpEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const jvp = child.type === 'jvp' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => (jvp ? loadJvpFormState(request, jvp) : null),
    [request, jvp]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !jvp || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The JVP detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: JvpFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updateJvpRequestFromState(state, {
      requestId: request.id,
      jvpRecordId: jvp.id,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <JvpForm
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

export default JvpEditForm;
export { JvpEditForm };
