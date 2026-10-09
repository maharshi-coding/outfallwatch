import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch-on-mount with manual refresh + optional interval polling. Tracks error/loading. */
export function useAsync<T>(fn: () => Promise<T>, opts: { pollMs?: number; deps?: unknown[] } = {}) {
  const { pollMs, deps = [] } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, pollMs, ...deps]);

  return { data, error, loading, refresh };
}
