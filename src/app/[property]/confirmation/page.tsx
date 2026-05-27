import { resolvePropertyBySlug } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { ConfirmationClient } from "./confirmation-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoConfirmation } from "@/themes/portico/screens/Confirmation";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const portico = await activePorticoTokens(property.templateSlug);
  if (portico) return <PorticoConfirmation t={portico} property={property} />;

  return <ConfirmationClient property={property} />;
}
