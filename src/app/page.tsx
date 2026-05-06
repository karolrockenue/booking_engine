import { resolveProperty } from "@/lib/get-property";
import { notFound } from "next/navigation";
import { HomeClient } from "./home-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoHome } from "@/themes/portico/screens/Home";

export default async function HomePage() {
  const property = await resolveProperty();
  if (!property) notFound();

  const portico = await activePorticoTokens();
  if (portico) return <PorticoHome t={portico} />;

  return <HomeClient property={property} />;
}
