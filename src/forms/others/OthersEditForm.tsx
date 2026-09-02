import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import OthersForm from './OthersForm';
import { loadOthersFormState, submitOtherRequest, updateOtherRequestFromState } from './api';
import type { OthersFormState } from './types';
import type { EditFormProps } from '../editRegistry';
import { getEditSubmissionCopy } from '../../shared/requestEditPolicy';
import { assertStillMissing } from '../repairRequest';

/**
 * Edit-mode adapter for "Others" requests (shared by GCPC matter 9 and GCP
 * matter 13). Resolves the matter, hydrates form state from the loaded parent +
 * child, and renders OthersForm in edit mode. The actual PATCH is delegated
 * through OthersForm's onEditSubmit so it carries the current form state.
 */
const OthersEditForm = ({
  request,
  child,
  editPurpose,
  onSaved,
  onResubmitted,
  onCancel,
}: EditFormProps) => {
  const editCopy = getEditSubmissionCopy(editPurpose);
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const other = child.type === 'other' ? (child.records[0] ?? null) : null;

  const initialState = useMemo(
    () => loadOthersFormState(request, other ?? undefined),
    [request, other]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !initialState || (!other && editPurpose !== 'repair')) {
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
    if (editPurpose === 'repair') {
      await assertStillMissing(request);
      await submitOtherRequest(state, {
        existingRequestId: request.id,
        documents,
      });
    } else {
      if (!other) throw new Error('The Others detail record is missing.');
      await updateOtherRequestFromState(state, {
        requestId: request.id,
        otherRecordId: other.id,
        documents,
      });
    }
    if (editPurpose === 'resubmission') {
      await onResubmitted();
    }
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: editCopy.toastMessage, tone: 'success' },
    };
  };

  return (
    <OthersForm
      matter={matter}
      mode="edit"
      editPurpose={editPurpose}
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
