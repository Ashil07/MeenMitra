"use client";

import { useCallback, useEffect, useState } from "react";

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (next: T) => void;
}

/**
 * Minimal data-fetching hook: runs `fn` on mount and whenever `deps` (primitives) change.
 * Errors are surfaced to the caller (never swallowed); stale responses are ignored.
 * Previous data stays visible while a refetch is in flight.
 */
export function useApiQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: unknown }>({ key: null, data: undefined, error: null });

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ key, data: s.data, error: error ?? new Error("Unknown error") }));
      },
    );
    return () => {
      cancelled = true;
    };
    // `fn` is intentionally excluded: callers pass an inline closure; `deps` define when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ key: s.key, data, error: null })), []);
  const settled = state.key === key;

  return { data: state.data, error: settled ? state.error : null, loading: !settled, reload, setData };
}

/** Wraps a mutation with pending / error state. `run` rethrows so callers can react. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(...args: A): Promise<R> {
    setPending(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, clearError: () => setError(null) };
}
