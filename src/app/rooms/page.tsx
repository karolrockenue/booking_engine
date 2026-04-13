import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { RoomsClient } from "./rooms-client";

export default async function RoomsPage() {
  const property = await resolveProperty();
  if (!property) notFound();

  return <RoomsClient property={property} />;
}
