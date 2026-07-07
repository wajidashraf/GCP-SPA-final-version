import { useMemo } from 'react';
import { InlineMessage } from '../../components/ui';
import { matterChoices } from '../../data/matterChoices';
import { parseDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { SubmitResult } from '../multistep';
import PblForm from './PblForm';
import { loadPblFormState, updatePblRequestFromState } from './api';
import type { PblFormState } from './types';
import type { EditFormProps } from '../editRegistry';

/**
 * Edit-mode adapter for PBL requests. Resolves the matter, hydrates form state
 * from the loaded parent + PBL child + bidder rows, and renders PblForm in
 * edit mode. The actual PATCH/diff is delegated through PblForm's onEditSubmit
 * so it carries the current (possibly changed) form state; the loaded bidder
 * rows are kept here as the diff baseline.
 */
const PblEditForm = ({ request, child, onSaved, onCancel }: EditFormProps) => {
  const matter = useMemo(
    () => matterChoices.find((m) => m.value === request.matter) ?? null,
    [request.matter]
  );

  const pblChild = child.type === 'pbl' ? child : null;
  const pbl = pblChild?.records[0] ?? null;

  // useRequestDetail loads bidders across the request's PBL records; scope the
  // baseline to the record actually being edited.
  const bidders = useMemo(
    () =>
      pblChild && pbl
        ? pblChild.bidders.filter((b) => b.pblRequestId === pbl.id)
        : [],
    [pblChild, pbl]
  );

  const initialState = useMemo(
    () => (pbl ? loadPblFormState(request, pbl, bidders) : null),
    [request, pbl, bidders]
  );

  // Existing documents stored on the parent request (gcp_documentsurl).
  const initialDocuments = useMemo(
    () => parseDocuments(request.documentsUrl),
    [request.documentsUrl]
  );

  if (!matter || !pbl || !initialState) {
    return (
      <InlineMessage tone="warning" title="Can’t edit this request">
        The PBL detail record for this request couldn’t be loaded, so it can’t
        be edited right now.{' '}
        <button type="button" className="rd-back-link" onClick={onCancel}>
          Go back
        </button>
      </InlineMessage>
    );
  }

  const handleEditSubmit = async (
    state: PblFormState,
    documents: DocumentLink[]
  ): Promise<SubmitResult> => {
    await updatePblRequestFromState(state, {
      requestId: request.id,
      pblRecordId: pbl.id,
      originalBidders: bidders,
      documents,
    });
    return {
      reference: request.title ?? request.id.slice(0, 8),
      toast: { message: 'Changes saved.', tone: 'success' },
    };
  };

  return (
    <PblForm
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

export default PblEditForm;
export { PblEditForm };
