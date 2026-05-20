import { resolveProperty } from "@/lib/get-property";
import { notFound, redirect } from "next/navigation";

// Bare "/" — no property slug in the path. Resolve by domain (a real hotel
// domain in production, or the deployment's default in dev/staging) and
// redirect to that property's path-scoped home, so the slug is always visible
// in the URL and every downstream page resolves from the path.
export default async function RootPage() {
  const property = await resolveProperty();
  if (!property) notFound();
  redirect(`/${property.slug}`);
}
