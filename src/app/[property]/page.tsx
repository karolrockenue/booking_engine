import {
  resolvePropertyBySlug,
  getPropertyPhotos,
  getPropertyContent,
} from "@/lib/get-property";
import { notFound } from "next/navigation";
import { HomeClient } from "./home-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoHome } from "@/themes/portico/screens/Home";
import { activeStreetTokens } from "@/themes/street";
import { StreetHome } from "@/themes/street/screens/Home";
import { activeEditorialCalmTokens } from "@/themes/editorial-calm";
import { EditorialCalmHome } from "@/themes/editorial-calm/screens/Home";
import { ecDefaultContent } from "@/themes/editorial-calm/content-defaults";
import { isValidTheme } from "@/lib/active-theme";
import {
  getPublishedLegalPages,
  buildLegalFineprintLinks,
} from "@/lib/legal";
import type { Metadata } from "next";

// Footer fine-print links derived from the property's published legal pages.
// Replaces the content block's links entirely so unpublished pages never leave
// dead "#" links in the footer.
async function legalFooterLinks(propertyId: string, propertySlug: string) {
  const pages = await getPublishedLegalPages(propertyId);
  return buildLegalFineprintLinks(propertySlug, pages);
}

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
    const [photos, content, legalLinks] = await Promise.all([
      getPropertyPhotos(property.id),
      getPropertyContent(property.id),
      legalFooterLinks(property.id, slug),
    ]);
    content.footer = { ...content.footer, fineprintLinks: legalLinks };
    return (
      <PorticoHome t={portico} slug={slug} photos={photos} content={content} />
    );
  }

  const street = await activeStreetTokens(effectiveSlug);
  if (street) {
    const [photos, content, legalLinks] = await Promise.all([
      getPropertyPhotos(property.id),
      getPropertyContent(property.id),
      legalFooterLinks(property.id, slug),
    ]);
    content.footer = { ...content.footer, fineprintLinks: legalLinks };
    return (
      <StreetHome
        t={street}
        slug={slug}
        name={property.name}
        photos={photos}
        content={content}
      />
    );
  }

  const editorialCalm = await activeEditorialCalmTokens(effectiveSlug);
  if (editorialCalm) {
    const [photos, content, legalLinks] = await Promise.all([
      getPropertyPhotos(property.id),
      // Editorial Calm ships its own seed copy (the Mason & Fifth voice);
      // saved content blocks still override field-by-field.
      getPropertyContent(property.id, ecDefaultContent),
      legalFooterLinks(property.id, slug),
    ]);
    content.footer = { ...content.footer, fineprintLinks: legalLinks };
    return (
      <EditorialCalmHome
        t={editorialCalm}
        slug={slug}
        name={property.name}
        photos={photos}
        content={content}
      />
    );
  }

  return <HomeClient property={property} />;
}
