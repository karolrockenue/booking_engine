"use client";

import { useEffect } from "react";
import type {
  BookingDraft,
  NightlyRate,
  PersistedBookingDraft,
} from "./types";

const STORAGE_KEY = "booking-draft";
const CONFIRMATION_KEY = "booking-confirmation";
const TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough for a hesitant guest
const CONFIRMATION_TTL_MS = 2 * 60 * 60 * 1000; // 2h: covers refresh / forwarding the URL to a partner

export interface PersistedConfirmation {
  orderId: string;
  bookingId: string;
  cloudbedsReservationId?: string;
  firstName: string;
  email: string;
  roomName: string;
  rateName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  totalPrice: number;
  nightlyRates: NightlyRate[];
  currency: string;
  savedAt: number;
}

interface PersistContext {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

/**
 * Mirror the in-memory draft to sessionStorage so the rooms → checkout
 * navigation survives without packing everything into URL params. Read with
 * loadPersistedDraft() on the receiving page.
 */
export function usePersistedDraft(
  ctx: PersistContext,
  draft: BookingDraft
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ctx.propertyId) return;

    const payload: PersistedBookingDraft = {
      propertyId: ctx.propertyId,
      checkIn: ctx.checkIn,
      checkOut: ctx.checkOut,
      adults: ctx.adults,
      children: ctx.children,
      result: draft.result,
      extras: Array.from(draft.extras),
      savedAt: Date.now(),
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage can throw in private mode / when full. Fail silently;
      // worst case the receiving page falls back to URL params or empty state.
    }
  }, [
    ctx.propertyId,
    ctx.checkIn,
    ctx.checkOut,
    ctx.adults,
    ctx.children,
    draft.result,
    draft.extras,
  ]);
}

export function loadPersistedDraft(): PersistedBookingDraft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedBookingDraft;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function savePersistedConfirmation(
  payload: Omit<PersistedConfirmation, "savedAt">
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CONFIRMATION_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function loadPersistedConfirmation(): PersistedConfirmation | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(CONFIRMATION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedConfirmation;
    if (Date.now() - parsed.savedAt > CONFIRMATION_TTL_MS) {
      sessionStorage.removeItem(CONFIRMATION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
