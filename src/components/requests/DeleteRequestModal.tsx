import { TriangleAlert } from 'lucide-react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import type { GcpRequest } from '../../types/request';
import { InlineMessage, Spinner } from '../ui';

type DeleteRequestTarget = {
  request: GcpRequest;
  matterLabel: string;
};

type DeleteRequestModalProps = {
  target: DeleteRequestTarget | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

const DeleteRequestModal = ({
  target,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteRequestModalProps) => (
  <Modal
    show={target !== null}
    onHide={isDeleting ? () => undefined : onCancel}
    centered
    backdrop="static"
    keyboard={!isDeleting}
    contentClassName="rq-delete-modal"
    aria-labelledby="delete-request-title"
  >
    <Modal.Header closeButton={!isDeleting}>
      <Modal.Title id="delete-request-title" className="rq-delete-modal-title">
        <TriangleAlert size={22} aria-hidden="true" />
        Delete request?
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p>
        You are about to permanently delete request{' '}
        <strong>{target?.request.title ?? target?.request.id}</strong>
        {target?.matterLabel ? ` (${target.matterLabel})` : ''}.
      </p>
      <p className="rq-delete-scope">
        This deletes the request and its matter-specific record. For PBL
        requests, related bidder rows are also deleted. SharePoint files and
        workflow records are not deleted.
      </p>
      {error ? (
        <InlineMessage tone="error" title="Couldn’t delete request">
          {error}
        </InlineMessage>
      ) : null}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel} disabled={isDeleting}>
        Cancel
      </Button>
      <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
        {isDeleting ? (
          <>
            <Spinner size={16} />
            Deleting…
          </>
        ) : (
          'Delete request'
        )}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default DeleteRequestModal;
export { DeleteRequestModal };
export type { DeleteRequestModalProps, DeleteRequestTarget };
