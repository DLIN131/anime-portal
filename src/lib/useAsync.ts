import { useEffect, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error: Error) => alive && setState({ error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
