import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePropertyBySlug } from "@/lib/get-property";
import {
  getPublishedLegalPage,
  isLegalSlug,
  renderLegalMarkdown,
} from "@/lib/legal";

type LegalPageProps = {
  params: Promise<{ property: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { property: propertySlug, slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const property = await resolvePropertyBySlug(propertySlug);
  if (!property) return {};
  const page = await getPublishedLegalPage(property.id, slug);
  if (!page) return {};
  return {
    title: `${page.title} · ${property.name}`,
    description: `${page.title} for ${property.name}.`,
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { property: propertySlug, slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const property = await resolvePropertyBySlug(propertySlug);
  if (!property) notFound();

  const page = await getPublishedLegalPage(property.id, slug);
  if (!page) notFound();

  const html = renderLegalMarkdown(page.body);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#faf8f3",
        color: "#1f1c18",
        fontFamily: "Georgia, 'Times New Roman', serif",
        padding: "0 24px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 0 96px" }}>
        <Link
          href={`/${property.slug}`}
          style={{
            display: "inline-block",
            marginBottom: 48,
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#6b6258",
            textDecoration: "none",
          }}
        >
          ← {property.name}
        </Link>

        <h1
          style={{
            fontSize: "clamp(30px, 5vw, 42px)",
            lineHeight: 1.1,
            fontWeight: 400,
            margin: "0 0 40px",
            letterSpacing: "-0.01em",
          }}
        >
          {page.title}
        </h1>

        <article
          className="legal-body"
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "#332f2a",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}
