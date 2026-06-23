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

type UseFormDraftOptions = {
  /**
   * When false, the draft is NOT read from or written to sessionStorage — the
   * hook behaves like plain `useState(initial)`. Used by edit mode so loading a
   * record can't be clobbered by (or leak into) the new-request draft. Default true.
   */
  persist?: boolean;
};

const useFormDraft = <T,>(
  key: string,
  initial: T,
  options: UseFormDraftOptions = {}
) => {
  const persist = options.persist ?? true;
  const [state, setState] = useState<T>(() =>
    persist ? (readDraft<T>(key) ?? initial) : initial
  );
  const firstRun = useRef(true);

  useEffect(() => {
    if (!persist) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
    } catch {
      // sessionStorage may be unavailable (private mode quota etc.) — ignore
    }
  }, [key, state, persist]);

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
