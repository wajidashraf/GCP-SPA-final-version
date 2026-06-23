// src/forms/editRegistry.ts
// Maps a matter code → the edit-mode form component for that request type.
// Consumed by the EditRequest page (/requests/:id/edit). A code with no entry
// means "editing isn't available for this request type yet".
//
// Roll-out: RTP is the reference implementation; other types are added here as
// their <Type>EditForm wrappers land (see docs/edit-request-mode-plan.md).

import type { ComponentType } from 'react';
import type { GcpRequest } from '../types/request';
import type { ChildData } from '../shared/hooks/useRequestDetail';
import { RtpEditForm } from './rtp/RtpEditForm';

/** Props every edit-form wrapper receives from the EditRequest page. */
type EditFormProps = {
  /** The loaded parent request (guaranteed present, status RS). */
  request: GcpRequest;
  /** The loaded child detail for this request's matter type. */
  child: ChildData;
  /** Called after a successful save — navigate back to the detail page. */
  onSaved: () => void;
  /** Called to abandon the edit — navigate back to the detail page. */
  onCancel: () => void;
};

const EDIT_FORM_REGISTRY: Partial<Record<string, ComponentType<EditFormProps>>> =
  {
    RTP: RtpEditForm,
  };

/** True when the given matter code has a registered edit form. */
const hasEditForm = (code: string | null | undefined): boolean =>
  !!code && !!EDIT_FORM_REGISTRY[code];

export { EDIT_FORM_REGISTRY, hasEditForm };
export type { EditFormProps };
