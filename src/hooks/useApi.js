import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with loading / error / reload handling. `fn` is re-run when `deps` change.
 * Stale responses (from an older set of deps) are ignored.
 */
export function useQuery(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Wraps a mutation: `pending` blocks duplicate submits; `error` keeps the last API error. */
export function useMutation(fn) {
  const [state, setState] = useState({ pending: false, error: null });
  const busy = useRef(false);
  const mutate = useCallback(
    async (...args) => {
      if (busy.current) return undefined;
      busy.current = true;
      setState({ pending: true, error: null });
      try {
        const result = await fn(...args);
        setState({ pending: false, error: null });
        return result;
      } catch (error) {
        setState({ pending: false, error });
        throw error;
      } finally {
        busy.current = false;
      }
    },
    [fn],
  );
  return { ...state, mutate, reset: () => setState({ pending: false, error: null }) };
}

/** Debounced value (search boxes). */
export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
