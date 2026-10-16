import { useCallback, useEffect, useRef, useState } from 'react';
import { listEngagementsByRequest } from '../services/engagementService';
import type { Engagement } from '../../types/engagement';
import { loadEngagementBooking } from '../engagementBookingApi';
import type { GcpRequest } from '../../types/request';

export const useRequestEngagements = (requestId: string | null | undefined, fresh = false) => {
  const [state, setState] = useState<{
    requestId: string | null; items: Engagement[]; loading: boolean; error: string | null;
    bookingRequest?: Pick<GcpRequest, 'status' | 'requestorContactId'>;
  }>({ requestId: null, items: [], loading: false, error: null });
  const generation = useRef(0);
  const activeId = useRef(requestId);
  activeId.current = requestId;
  const refetch = useCallback(async () => {
    const current = ++generation.current;
    if (!requestId) {
      setState({ requestId: null, items: [], loading: false, error: null });
      return;
    }
    setState({ requestId, items: [], loading: true, error: null });
    try {
      const snapshot = fresh ? await loadEngagementBooking(requestId) : null;
      const items = snapshot?.engagements ?? await listEngagementsByRequest(requestId);
      if (current === generation.current && requestId === activeId.current) {
        setState({ requestId, items, bookingRequest: snapshot?.request, loading: false, error: null });
      }
    } catch (err) {
      if (current === generation.current && requestId === activeId.current) {
        setState({ requestId, items: [], loading: false, error: err instanceof Error ? err.message : 'Could not load engagement bookings.' });
      }
    }
  }, [requestId, fresh]);
  useEffect(() => {
    void refetch();
    return () => { generation.current += 1; };
  }, [refetch]);
  return state.requestId === (requestId ?? null)
    ? { ...state, refetch }
    : { items: [] as Engagement[], bookingRequest: undefined, loading: Boolean(requestId), error: null, refetch };
};
