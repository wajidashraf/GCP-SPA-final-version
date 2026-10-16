import { useCallback, useEffect, useRef, useState } from 'react';
import { listSignaturesForRequest } from '../services/signatureService';
import type { GcpSignature } from '../services/signatureService';

type RequestHistoryState = {
  signatures: GcpSignature[];
  isLoading: boolean;
  error: string | null;
};

/** Call only with an ID whose parent request was successfully authorized/read. */
export const useRequestHistory = (requestId: string | null | undefined): RequestHistoryState & {
  refetch: () => Promise<void>;
} => {
  const [state, setState] = useState<RequestHistoryState & { requestId: string | null }>({
    requestId: null, signatures: [], isLoading: false, error: null,
  });
  const generation = useRef(0);
  const activeId = useRef(requestId);
  activeId.current = requestId;

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    const isCurrent = () => generation.current === currentGeneration && activeId.current === requestId;
    if (!requestId) {
      setState({ requestId: null, signatures: [], isLoading: false, error: null });
      return;
    }
    setState({ requestId, signatures: [], isLoading: true, error: null });
    try {
      const signatures = await listSignaturesForRequest(requestId);
      if (isCurrent()) setState({ requestId, signatures, isLoading: false, error: null });
    } catch (err) {
      if (isCurrent()) setState({
        requestId, signatures: [], isLoading: false,
        error: err instanceof Error ? err.message : 'Unable to load saved signature history.',
      });
    }
  }, [requestId]);

  useEffect(() => {
    void load();
    return () => { generation.current += 1; };
  }, [load]);

  // Do not show the previous request's events for the render before effect cleanup.
  if (state.requestId !== (requestId ?? null)) {
    return { signatures: [], isLoading: Boolean(requestId), error: null, refetch: load };
  }
  return { signatures: state.signatures, isLoading: state.isLoading, error: state.error, refetch: load };
};
