"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  RyftProvider,
  CardForm,
  type RyftCardFormInstance,
  type RyftCardFormTheme,
} from "@ryftpay/react";

// Storefront card form on Ryft's React SDK. Renders separated fields (card
// number / expiry / CVC on their own rows, plus name-on-card) — the Stripe-like
// multi-field layout — and exposes the same confirm() handle the Stripe section
// does, so checkout-client/theme screens stay rail-agnostic.

export interface RyftConfirmResult {
  paymentSessionId?: string;
  status?: string;
}

export interface RyftPaymentSectionHandle {
  confirm: () => Promise<RyftConfirmResult>;
}

// Brand hooks so each theme can colour the form to match (concrete colour
// strings — the SDK renders fields in isolated frames, so CSS vars don't cross).
export interface RyftBrand {
  accent?: string;
  ink?: string;
  rule?: string;
}

interface Props {
  clientSecret: string;
  publicKey: string;
  accountId?: string | null;
  brand?: RyftBrand;
}

function buildTheme(brand?: RyftBrand): RyftCardFormTheme {
  return {
    inputBorderColor: brand?.rule ?? "#D4D4D4",
    inputFocusBorderColor: brand?.accent ?? "#5B4CFF",
    inputFocusColor: brand?.accent ?? "#5B4CFF",
    inputTextColor: brand?.ink ?? "#1A1A1A",
    inputLabelTextColor: brand?.ink ?? "#1A1A1A",
    inputPlaceholderColor: "#9A9A9A",
    inputBackgroundColor: "#FFFFFF",
    inputBorderRadius: 4,
    inputBorderWidth: 1,
    cardFormGap: 16,
  } as RyftCardFormTheme;
}

const RyftPaymentSection = forwardRef<RyftPaymentSectionHandle, Props>(
  function RyftPaymentSection({ clientSecret, publicKey, accountId, brand }, ref) {
    const cardFormRef = useRef<RyftCardFormInstance>(null);
    const [error, setError] = useState<string | null>(null);
    const validRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        async confirm(): Promise<RyftConfirmResult> {
          const form = cardFormRef.current;
          if (!form) throw new Error("Payment form is still loading");
          if (!validRef.current) {
            throw new Error(
              "Please complete all card fields — card number, expiry, CVC, and name on card."
            );
          }
          const res = await form.attemptPayment();
          if (res.type === "final") {
            const status = res.paymentSession?.status;
            if (status === "Approved" || status === "Captured") {
              return { status, paymentSessionId: res.paymentSession?.id };
            }
            throw new Error(
              res.userFacingErrorMessage || "Payment was not completed"
            );
          }
          // ActionRequired (3DS): with manuallyHandleActions=false (default) the
          // SDK resolves a final response after handling it, so reaching here is
          // unexpected — surface a retry message rather than silently succeeding.
          throw new Error("Additional authentication is required — please try again.");
        },
      }),
      []
    );

    if (!publicKey || !clientSecret) {
      return (
        <div
          className="text-sm p-4 rounded"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          Payment is not configured (missing Ryft key). Please contact the hotel.
        </div>
      );
    }

    return (
      <RyftProvider
        publicKey={publicKey}
        clientSecret={clientSecret}
        accountId={accountId ?? undefined}
        onError={(e) => setError(e?.message ?? "Payment error")}
      >
        <CardForm
          ref={cardFormRef}
          displayConfig={{ fieldLayout: "separated", showInputIcons: true }}
          paymentFieldConfig={{ collectNameOnCard: true }}
          theme={buildTheme(brand)}
          validationMode="onBlur"
          onReady={() => setError(null)}
          onValidationChange={(e) => {
            validRef.current = !!e.isValid;
            if (e.isValid) setError(null);
          }}
        />
        {error && (
          <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{error}</div>
        )}
      </RyftProvider>
    );
  }
);

export default RyftPaymentSection;
