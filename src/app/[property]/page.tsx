import {
  resolvePropertyBySlug,
  getPropertyPhotos,
  getPropertyContent,
} from "@/lib/get-property";
import { notFound } from "next/navigation";
import { HomeClient } from "./home-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoHome } from "@/themes/portico/screens/Home";
import { isValidTheme } from "@/lib/active-theme";
import type { Metadata } from "next";

type HomePageProps = {
  params: Promise<{ property: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// `?_template=<slug>` is a preview-only override used by the admin Design tab
// to iframe each template side-by-side without changing the hotel's saved
// template. Always `noindex` so previews never leak into search.
function pickPreviewSlug(
  sp: { [key: string]: string | string[] | undefined }
): string | null {
  const raw = sp._template;
  if (typeof raw !== "string") return null;
  return isValidTheme(raw) ? raw : null;
}

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  const sp = await searchParams;
  if (pickPreviewSlug(sp)) {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const sp = await searchParams;
  const effectiveSlug = pickPreviewSlug(sp) ?? property.templateSlug;

  const portico = await activePorticoTokens(effectiveSlug);
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
