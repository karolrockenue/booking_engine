"use client";

import { useEffect, useState } from "react";
import type { Extra } from "./types";

export function useExtras(propertyId: string): {
  extras: Extra[];
  loading: boolean;
  error: Error | null;
} {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!propertyId) return;

    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/extras?propertyId=${encodeURIComponent(propertyId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Extras ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setExtras((data?.extras as Extra[] | undefined) ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return { extras, loading, error };
}
