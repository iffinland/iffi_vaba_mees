import { useCallback, useEffect, useState } from 'react';
import { getMonthlySupportStatus } from '../services/monthlySupportService';

const initialState = {
  loading: true,
  error: '',
  state: 'loading',
  record: null,
  profile: null,
  timeRemainingMs: 0,
};

export function useMonthlySupportStatus({ enabled = true } = {}) {
  const [status, setStatus] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setStatus({ ...initialState, loading: false, state: 'disabled' });
      return;
    }

    setStatus((current) => ({ ...current, loading: true, error: '' }));

    try {
      const nextStatus = await getMonthlySupportStatus();
      setStatus({
        loading: false,
        error: '',
        state: nextStatus.state,
        record: nextStatus.record ?? null,
        profile: nextStatus.profile ?? null,
        timeRemainingMs: nextStatus.timeRemainingMs ?? 0,
      });
    } catch (error) {
      setStatus({
        ...initialState,
        loading: false,
        state: 'error',
        error: error instanceof Error ? error.message : 'Unable to load support status.',
      });
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, refresh };
}
