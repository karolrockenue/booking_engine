import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { ConfirmationClient } from "./confirmation-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoConfirmation } from "@/themes/portico/screens/Confirmation";

export default async function ConfirmationPage() {
  const property = await resolveProperty();
  if (!property) notFound();

  const portico = await activePorticoTokens();
  if (portico) return <PorticoConfirmation t={portico} property={property} />;

  return <ConfirmationClient property={property} />;
}
