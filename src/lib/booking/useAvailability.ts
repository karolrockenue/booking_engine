"use client";

import { useEffect, useState } from "react";
import type { AvailabilityResult } from "./types";

interface UseAvailabilityArgs {
  propertyId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  adults: number;
}

export function useAvailability(args: UseAvailabilityArgs): {
  results: AvailabilityResult[];
  loading: boolean;
  error: Error | null;
} {
  const { propertyId, checkIn, checkOut, adults } = args;
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut) return;

    let cancelled = false;
    // Showing a loading state during refetch is the intent; the cascading
    // render is the accepted cost.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    const params = new URLSearchParams({
      propertyId,
      checkIn,
      checkOut,
      adults: String(adults),
    });

    fetch(`/api/availability?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Availability ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setResults((data?.results as AvailabilityResult[] | undefined) ?? []);
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
  }, [propertyId, checkIn, checkOut, adults]);

  return { results, loading, error };
}
