import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { ConfirmationClient } from "./confirmation-client";

export default async function ConfirmationPage() {
  const property = await resolveProperty();
  if (!property) notFound();

  return <ConfirmationClient property={property} />;
}
