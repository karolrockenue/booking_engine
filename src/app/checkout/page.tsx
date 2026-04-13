import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage() {
  const property = await resolveProperty();
  if (!property) notFound();

  return <CheckoutClient property={property} />;
}
