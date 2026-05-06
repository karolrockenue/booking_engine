"use client";

import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { forwardRef, useImperativeHandle } from "react";
import { getStripeBrowser } from "@/lib/stripe/browser";

export type IntentKind = "payment" | "setup";

export interface StripeConfirmResult {
  paymentIntentId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
}

export interface StripePaymentSectionHandle {
  confirm: () => Promise<StripeConfirmResult>;
}

interface Props {
  kind: IntentKind;
  clientSecret: string;
  appearance?: Appearance;
}

const StripePaymentSection = forwardRef<StripePaymentSectionHandle, Props>(
  function StripePaymentSection({ kind, clientSecret, appearance }, ref) {
    return (
      <Elements
        // Re-mount when the intent changes (e.g. user navigates back, total
        // recalculates). Stripe Elements options.clientSecret is set-once.
        key={clientSecret}
        stripe={getStripeBrowser()}
        options={{
          clientSecret,
          appearance: appearance ?? { theme: "stripe" },
        }}
      >
        <InnerForm
          kind={kind}
          clientSecret={clientSecret}
          forwardedRef={ref}
        />
      </Elements>
    );
  }
);

export default StripePaymentSection;

function InnerForm({
  kind,
  clientSecret,
  forwardedRef,
}: {
  kind: IntentKind;
  clientSecret: string;
  forwardedRef: React.ForwardedRef<StripePaymentSectionHandle>;
}) {
  const stripe = useStripe();
  const elements = useElements();

  useImperativeHandle(
    forwardedRef,
    () => ({
      async confirm(): Promise<StripeConfirmResult> {
        if (!stripe || !elements) {
          throw new Error("Payment form is still loading");
        }

        const { error: submitError } = await elements.submit();
        if (submitError) {
          throw new Error(
            submitError.message ?? "Card details could not be validated"
          );
        }

        if (kind === "payment") {
          const result = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: { return_url: window.location.href },
            redirect: "if_required",
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Payment failed");
          }
          const pi = result.paymentIntent;
          return {
            paymentIntentId: pi?.id,
            paymentMethodId:
              typeof pi?.payment_method === "string"
                ? pi.payment_method
                : pi?.payment_method?.id,
          };
        }

        const result = await stripe.confirmSetup({
          elements,
          clientSecret,
          confirmParams: { return_url: window.location.href },
          redirect: "if_required",
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Card setup failed");
        }
        const si = result.setupIntent;
        return {
          setupIntentId: si?.id,
          paymentMethodId:
            typeof si?.payment_method === "string"
              ? si.payment_method
              : si?.payment_method?.id,
        };
      },
    }),
    [stripe, elements, kind, clientSecret]
  );

  return <PaymentElement />;
}
