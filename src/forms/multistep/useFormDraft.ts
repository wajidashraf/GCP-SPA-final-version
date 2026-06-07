import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'formDraft:';

const readDraft = <T,>(key: string): T | undefined => {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
};

const useFormDraft = <T,>(key: string, initial: T) => {
  const [state, setState] = useState<T>(() => readDraft<T>(key) ?? initial);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
    } catch {
      // sessionStorage may be unavailable (private mode quota etc.) — ignore
    }
  }, [key, state]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // ignore
    }
  };

  return { state, setState, clearDraft } as const;
};

export { useFormDraft };
