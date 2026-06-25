"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

// Ryft Embedded SDK card form — the Ryft analog of StripePaymentSection. The
// SDK renders its own card fields into the `.Ryft--paysection` > `.Ryft--payform`
// markup below once Ryft.init() runs, and confirm() drives attemptPayment().
// The parent owns the submit button and calls confirm() via the ref, exactly
// like the Stripe section, so checkout-client stays rail-agnostic.

const SDK_SRC = "https://embedded.ryftpay.com/v2/ryft.min.js";

interface RyftSdk {
  init: (opts: {
    publicKey: string;
    clientSecret: string;
    accountId?: string;
  }) => void;
  attemptPayment: () => Promise<{ status?: string; lastError?: string }>;
  getUserFacingErrorMessage: (err?: string) => string;
}

interface RyftWindow extends Window {
  Ryft?: RyftSdk;
}

export interface RyftConfirmResult {
  paymentSessionId?: string;
  status?: string;
}

export interface RyftPaymentSectionHandle {
  confirm: () => Promise<RyftConfirmResult>;
}

interface Props {
  clientSecret: string;
  publicKey: string;
  accountId?: string | null;
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as RyftWindow).Ryft) return resolve();
    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load the Ryft payment SDK"));
    document.head.appendChild(s);
  });
}

const RyftPaymentSection = forwardRef<RyftPaymentSectionHandle, Props>(
  function RyftPaymentSection({ clientSecret, publicKey, accountId }, ref) {
    // Track which session has actually mounted / errored, keyed by clientSecret,
    // so we never reset state synchronously in the effect (which triggers
    // cascading renders). `ready`/`loadError` are derived from these below.
    const [mountedSecret, setMountedSecret] = useState<string | null>(null);
    const [errState, setErrState] = useState<{ secret: string; message: string } | null>(null);

    // (Re)mount the SDK whenever the session changes — Ryft.init binds to one
    // clientSecret, mirroring Stripe Elements' set-once clientSecret.
    useEffect(() => {
      let cancelled = false;
      loadSdk()
        .then(() => {
          if (cancelled) return;
          const ryft = (window as RyftWindow).Ryft;
          if (!ryft) throw new Error("Ryft SDK unavailable");
          ryft.init({ publicKey, clientSecret, accountId: accountId ?? undefined });
          setMountedSecret(clientSecret);
        })
        .catch((e) => {
          if (!cancelled)
            setErrState({
              secret: clientSecret,
              message: e instanceof Error ? e.message : "SDK error",
            });
        });
      return () => {
        cancelled = true;
      };
    }, [clientSecret, publicKey, accountId]);

    const ready = mountedSecret === clientSecret;
    const loadError = errState?.secret === clientSecret ? errState.message : null;

    useImperativeHandle(
      ref,
      () => ({
        async confirm(): Promise<RyftConfirmResult> {
          const ryft = (window as RyftWindow).Ryft;
          if (!ryft) throw new Error("Payment form is still loading");
          const result = await ryft.attemptPayment();
          if (result.status === "Approved" || result.status === "Captured") {
            return { status: result.status };
          }
          throw new Error(
            ryft.getUserFacingErrorMessage(result.lastError) ||
              result.lastError ||
              "Payment was not completed"
          );
        },
      }),
      []
    );

    if (loadError) {
      return (
        <div
          className="text-sm p-4 rounded"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {loadError}
        </div>
      );
    }

    return (
      <div className="Ryft--paysection">
        <form id="ryft-pay-form" className="Ryft--payform" onSubmit={(e) => e.preventDefault()}>
          <div id="ryft-pay-error" style={{ color: "#c00", fontSize: 13 }} />
        </form>
        {!ready && (
          <div
            className="text-sm p-4 rounded text-center"
            style={{ backgroundColor: "#fafafa", color: "var(--color-text-muted)" }}
          >
            Loading secure payment form…
          </div>
        )}
      </div>
    );
  }
);

export default RyftPaymentSection;
