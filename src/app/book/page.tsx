import { redirect } from "next/navigation";
import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoDates } from "@/themes/portico/screens/Dates";

export default async function BookPage() {
  const portico = await activePorticoTokens();
  if (!portico) {
    // Default flow: booking widget lives on the homepage.
    redirect("/");
  }

  const property = await resolveProperty();
  if (!property) notFound();

  return <PorticoDates t={portico} currency={property.currency ?? "GBP"} />;
}
