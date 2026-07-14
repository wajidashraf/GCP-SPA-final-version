// src/forms/editRegistry.ts
// Maps a matter code → the edit-mode form component for that request type.
// Consumed by the EditRequest page (/requests/:id/edit). A code with no entry
// means "editing isn't available for this request type yet".
//
// Roll-out: complete — all 13 matter codes (14 matter values; 'Others' covers
// both GCPC=9 and GCP=13) have a registered <Type>EditForm wrapper. RTP was the
// reference implementation (see docs/edit-request-mode-plan.md).

import type { ComponentType } from 'react';
import type { GcpRequest } from '../types/request';
import type { ChildData } from '../shared/hooks/useRequestDetail';
import { RtpEditForm } from './rtp/RtpEditForm';
import { PblEditForm } from './pbl/PblEditForm';
import { JvpEditForm } from './jvp/JvpEditForm';
import { CaaEditForm } from './caa/CaaEditForm';
import { StspEditForm } from './stsp/StspEditForm';
import { PpEditForm } from './pp/PpEditForm';
import { VapEditForm } from './vap/VapEditForm';
import { OthersEditForm } from './others/OthersEditForm';
import { CiEditForm } from './ci/CiEditForm';
import { CprEditForm } from './cpr/CprEditForm';
import { PccaEditForm } from './pcca/PccaEditForm';
import { RpccaEditForm } from './rpcca/RpccaEditForm';
import { RppEditForm } from './rpp/RppEditForm';

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
    PBL: PblEditForm,
    JVP: JvpEditForm,
    CAA: CaaEditForm,
    // The ST/SP matter code contains a slash (see matterChoices.ts).
    'ST/SP': StspEditForm,
    PP: PpEditForm,
    VAP: VapEditForm,
    // Matter code 'Others' covers both GCPC (value 9) and GCP (value 13).
    Others: OthersEditForm,
    CI: CiEditForm,
    CPR: CprEditForm,
    PCCA: PccaEditForm,
    'R-PCCA': RpccaEditForm,
    'R-PP': RppEditForm,
  };

/** True when the given matter code has a registered edit form. */
const hasEditForm = (code: string | null | undefined): boolean =>
  !!code && !!EDIT_FORM_REGISTRY[code];

export { EDIT_FORM_REGISTRY, hasEditForm };
export type { EditFormProps };
