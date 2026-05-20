import {
  resolvePropertyBySlug,
  getPropertyPhotos,
  getPropertyContent,
} from "@/lib/get-property";
import { notFound } from "next/navigation";
import { HomeClient } from "./home-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoHome } from "@/themes/portico/screens/Home";

export default async function HomePage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const portico = await activePorticoTokens();
  if (portico) {
    const [photos, content] = await Promise.all([
      getPropertyPhotos(property.id),
      getPropertyContent(property.id),
    ]);
    return (
      <PorticoHome t={portico} slug={slug} photos={photos} content={content} />
    );
  }

  return <HomeClient property={property} />;
}
