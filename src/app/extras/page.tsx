import { redirect } from "next/navigation";
import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoExtras } from "@/themes/portico/screens/Extras";

export default async function ExtrasPage() {
  const portico = await activePorticoTokens();
  if (!portico) {
    // Default theme handles extras inline on /rooms — no dedicated page.
    redirect("/");
  }

  const property = await resolveProperty();
  if (!property) notFound();

  return <PorticoExtras t={portico} property={property} />;
}
