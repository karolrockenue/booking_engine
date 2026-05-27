import { redirect, notFound } from "next/navigation";
import { resolvePropertyBySlug } from "@/lib/get-property";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoExtras } from "@/themes/portico/screens/Extras";

export default async function ExtrasPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const portico = await activePorticoTokens(property.templateSlug);
  if (!portico) {
    // Default theme handles extras inline on /rooms — no dedicated page.
    redirect(`/${slug}`);
  }

  return <PorticoExtras t={portico} property={property} />;
}
