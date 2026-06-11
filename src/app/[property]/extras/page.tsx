import { redirect, notFound } from "next/navigation";
import { resolvePropertyBySlug, getPropertyPhotos } from "@/lib/get-property";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoExtras } from "@/themes/portico/screens/Extras";
import { activeStreetTokens } from "@/themes/street";
import { StreetExtras } from "@/themes/street/screens/Extras";
import { activeEditorialCalmTokens } from "@/themes/editorial-calm";
import { EditorialCalmExtras } from "@/themes/editorial-calm/screens/Extras";

export default async function ExtrasPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const portico = await activePorticoTokens(property.templateSlug);
  if (portico) return <PorticoExtras t={portico} property={property} />;

  const street = await activeStreetTokens(property.templateSlug);
  if (street) {
    const photos = await getPropertyPhotos(property.id);
    return <StreetExtras t={street} property={property} photos={photos} />;
  }

  const editorialCalm = await activeEditorialCalmTokens(property.templateSlug);
  if (editorialCalm) {
    const photos = await getPropertyPhotos(property.id);
    return <EditorialCalmExtras t={editorialCalm} property={property} photos={photos} />;
  }

  // Default theme handles extras inline on /rooms — no dedicated page.
  redirect(`/${slug}`);
}
