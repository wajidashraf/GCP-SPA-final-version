import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { InlineMessage, LoadingState } from '../components/ui';
import { useRequestDetail } from '../shared/hooks/useRequestDetail';
import { useAuth } from '../context/AuthContext';
import { isAdmin, hasRole } from '../utils/authorization';
import { matterChoices } from '../data/matterChoices';
import { EDIT_FORM_REGISTRY } from '../forms/editRegistry';
import {
  canRenderEditRequest,
  getEditPurpose,
  isAuthorizedRequestEditor,
  isEditableRequestStatus,
} from '../shared/requestEditPolicy';
import { markRequestResubmitted } from '../shared/services/requestService';
import { notifyEvent } from '../shared/notificationApi';

export default function EditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, child, isLoading, error, childError } = useRequestDetail(id);
  const { user, isLoading: authLoading } = useAuth();
  const canRenderEdit = canRenderEditRequest({
    authLoading,
    requestLoading: isLoading,
    routeId: id,
    requestId: request?.id,
  });

  const backToDetail = () => navigate(`/requests/${id}`);
  const handleResubmitted = async () => {
    if (!id) throw new Error('Missing request ID.');
    await markRequestResubmitted(id);
    void notifyEvent(id, 'request_resubmitted', user?.email);
  };

  // Who may edit: the requestor (owner), a Reviewer, a Verifier, or an admin.
  // All guards wait for auth + record load to resolve (never redirect while loading).
  const accessDenied = useMemo(() => {
    if (!request || authLoading) return false;
    return !isAuthorizedRequestEditor(request.requestorContactId, {
      contactId: user?.contactId,
      isAdmin: isAdmin(),
      isReviewer: hasRole('Reviewer'),
      isVerifier: hasRole('Verifier'),
    });
  }, [request, authLoading, user]);

  const isEditableStatus = isEditableRequestStatus(request?.status);
  const editPurpose = getEditPurpose(request?.status);

  const matterCode = useMemo(
    () =>
      request
        ? (matterChoices.find((m) => m.value === request.matter)?.code ?? null)
        : null,
    [request]
  );
  const EditForm = matterCode ? EDIT_FORM_REGISTRY[matterCode] : undefined;

  // Redirect away from records the user can't edit (no access) or that are no
  // longer in New, R, or RS — re-checked from the freshly loaded record.
  useEffect(() => {
    if (!canRenderEdit || !request) return;
    if (accessDenied) {
      const t = setTimeout(() => navigate('/requests', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
    if (!isEditableStatus) {
      const t = setTimeout(
        () => navigate(`/requests/${id}`, { replace: true }),
        2500
      );
      return () => clearTimeout(t);
    }
  }, [canRenderEdit, request, accessDenied, isEditableStatus, id, navigate]);

  return (
    <section className="rd-page">
      <div className="container">
        <div className="rd-back">
          <button
            type="button"
            className="rd-back-link"
            onClick={backToDetail}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to request
          </button>
        </div>

        {isLoading || authLoading ? (
          <LoadingState message="Loading request…" size="lg" />
        ) : null}

        {!authLoading && error ? (
          <InlineMessage tone="error" title="Couldn’t load this request">
            {error}
          </InlineMessage>
        ) : null}

        {!isLoading && !authLoading && !error && !request ? (
          <InlineMessage tone="warning" title="Request not found">
            We couldn’t find a request with this ID.{' '}
            <Link to="/requests">Return to the requests list.</Link>
          </InlineMessage>
        ) : null}

        {canRenderEdit && request && accessDenied ? (
          <InlineMessage
            tone="warning"
            title="You don’t have access to edit this request"
          >
            Redirecting you back to the requests list…{' '}
            <Link to="/requests">Go now.</Link>
          </InlineMessage>
        ) : null}

        {canRenderEdit && request && !accessDenied && !isEditableStatus ? (
          <InlineMessage tone="info" title="This request can no longer be edited">
            Editing is only available while a request is in <strong>New</strong>,{' '}
            <strong>R</strong>, or <strong>RS</strong>. Redirecting you back…{' '}
            <Link to={`/requests/${id}`}>Go now.</Link>
          </InlineMessage>
        ) : null}

        {canRenderEdit &&
        request &&
        !accessDenied &&
        isEditableStatus &&
        !EditForm ? (
          <InlineMessage
            tone="info"
            title="Editing isn’t available for this request type yet"
          >
            The edit form for <strong>{matterCode ?? 'this'}</strong> requests
            isn’t available yet.{' '}
            <Link to={`/requests/${id}`}>Back to the request.</Link>
          </InlineMessage>
        ) : null}

        {canRenderEdit &&
        request &&
        !accessDenied &&
        isEditableStatus &&
        editPurpose &&
        EditForm ? (
          <>
            <header className="rd-hero">
              <div className="rd-hero-main">
                <h1 className="rd-hero-title mb-2">
                  <Pencil size={20} aria-hidden="true" /> Edit request
                </h1>
                <div className="rd-hero-eyebrow">
                  {matterCode ? (
                    <span className="rd-chan-badge">{matterCode}</span>
                  ) : null}
                  <span className="rd-hero-id">
                    {request.title ?? `Request ${request.id.slice(0, 8)}`}
                  </span>
                </div>
              </div>
            </header>

            {child ? (
              <EditForm
                request={request}
                child={child}
                editPurpose={editPurpose}
                onSaved={backToDetail}
                onResubmitted={handleResubmitted}
                onCancel={backToDetail}
              />
            ) : isLoading ? (
              <LoadingState message="Loading request details…" />
            ) : (
              // Child failed to load — editing needs it, so this is a hard stop
              // (not the read-only detail page's soft "some details missing").
              <InlineMessage
                tone="error"
                title="This request’s details couldn’t be loaded"
              >
                {childError
                  ? `We couldn’t load the details needed to edit this request: ${childError}`
                  : 'We couldn’t load the details needed to edit this request.'}{' '}
                <button
                  type="button"
                  className="rd-back-link"
                  onClick={backToDetail}
                >
                  Back to request
                </button>
              </InlineMessage>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
