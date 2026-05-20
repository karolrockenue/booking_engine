import { redirect, notFound } from "next/navigation";
import { resolvePropertyBySlug } from "@/lib/get-property";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoDates } from "@/themes/portico/screens/Dates";

export default async function BookPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const portico = await activePorticoTokens();
  if (!portico) {
    // Default theme: booking widget lives on the homepage.
    redirect(`/${slug}`);
  }

  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  return <PorticoDates t={portico} currency={property.currency ?? "GBP"} />;
}
