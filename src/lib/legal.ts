import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { db } from "@/db";
import { legalPages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { LEGAL_SLUGS, LEGAL_LABELS, isLegalSlug } from "@/lib/legal-constants";

export {
  LEGAL_SLUGS,
  LEGAL_LABELS,
  isLegalSlug,
  type LegalSlug,
} from "@/lib/legal-constants";

export interface LegalPageRow {
  slug: string;
  title: string;
  body: string;
  published: boolean;
}

// Markdown → sanitized HTML. Authors are admin-only, but we sanitize anyway as
// defence in depth. Rendered server-side, injected via dangerouslySetInnerHTML.
export function renderLegalMarkdown(markdown: string): string {
  const html = marked.parse(markdown ?? "", { async: false }) as string;
  return DOMPurify.sanitize(html);
}

// A single published legal page for the storefront, or null (→ 404).
export async function getPublishedLegalPage(
  propertyId: string,
  slug: string
): Promise<LegalPageRow | null> {
  const [row] = await db
    .select()
    .from(legalPages)
    .where(
      and(eq(legalPages.propertyId, propertyId), eq(legalPages.slug, slug))
    )
    .limit(1);
  if (!row || !row.published) return null;
  return row;
}

// All published pages for a property — used to build the footer links.
export async function getPublishedLegalPages(
  propertyId: string
): Promise<LegalPageRow[]> {
  const rows = await db
    .select()
    .from(legalPages)
    .where(
      and(eq(legalPages.propertyId, propertyId), eq(legalPages.published, true))
    );
  // Keep the canonical slug order.
  return LEGAL_SLUGS.map((s) => rows.find((r) => r.slug === s)).filter(
    (r): r is typeof rows[number] => Boolean(r)
  );
}

// Footer fine-print links for the published pages, in canonical order.
export function buildLegalFineprintLinks(
  propertySlug: string,
  published: LegalPageRow[]
): Array<{ label: string; href: string }> {
  return published.map((p) => ({
    label: isLegalSlug(p.slug) ? LEGAL_LABELS[p.slug] : p.title,
    href: `/${propertySlug}/legal/${p.slug}`,
  }));
}
