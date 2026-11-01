import { useEffect, useState } from 'react';

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/**
 * Loads data from an API function. Each feature exposes plain async functions
 * (src/api/*.ts) that resolve mock data today and call the FastAPI backend later.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: undefined, error: undefined, loading: true });

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => live && setState({ data, error: undefined, loading: false }),
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** Simulated network latency for mock responses. */
export function mock<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
}
