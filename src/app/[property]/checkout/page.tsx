import { resolvePropertyBySlug } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { CheckoutClient } from "./checkout-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoCheckout } from "@/themes/portico/screens/Checkout";
import { activeStreetTokens } from "@/themes/street";
import { StreetCheckout } from "@/themes/street/screens/Checkout";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const portico = await activePorticoTokens(property.templateSlug);
  if (portico) return <PorticoCheckout t={portico} property={property} />;

  const street = await activeStreetTokens(property.templateSlug);
  if (street) return <StreetCheckout t={street} property={property} />;

  return <CheckoutClient property={property} />;
}
