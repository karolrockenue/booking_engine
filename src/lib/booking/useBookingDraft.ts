"use client";

import { useCallback, useMemo, useState } from "react";
import type { AvailabilityResult, BookingDraft, Extra } from "./types";

export function useBookingDraft(
  extras: Extra[],
  initial?: BookingDraft
): {
  draft: BookingDraft;
  selectRoom: (result: AvailabilityResult) => void;
  clearRoom: () => void;
  toggleExtra: (extraId: string) => void;
  setExtras: (extras: Set<string>) => void;
  extrasTotal: number; // converted from minor units
  grandTotal: number;
} {
  const [draft, setDraft] = useState<BookingDraft>(
    initial ?? { result: null, extras: new Set() }
  );

  const selectRoom = useCallback((result: AvailabilityResult) => {
    setDraft({ result, extras: new Set() });
  }, []);

  const clearRoom = useCallback(() => {
    setDraft({ result: null, extras: new Set() });
  }, []);

  const toggleExtra = useCallback((extraId: string) => {
    setDraft((d) => {
      const next = new Set(d.extras);
      if (next.has(extraId)) next.delete(extraId);
      else next.add(extraId);
      return { ...d, extras: next };
    });
  }, []);

  const setExtras = useCallback((extras: Set<string>) => {
    setDraft((d) => ({ ...d, extras }));
  }, []);

  const extrasTotal = useMemo(() => {
    let total = 0;
    for (const id of draft.extras) {
      const e = extras.find((x) => x.id === id);
      if (e) total += e.priceMinorUnits / 100;
    }
    return total;
  }, [draft.extras, extras]);

  const grandTotal = (draft.result?.totalPrice ?? 0) + extrasTotal;

  return {
    draft,
    selectRoom,
    clearRoom,
    toggleExtra,
    setExtras,
    extrasTotal,
    grandTotal,
  };
}
