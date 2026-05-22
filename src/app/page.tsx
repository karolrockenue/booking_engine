import { headers } from "next/headers";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RockenueLanding } from "@/components/rockenue/Landing";

// Bare "/" resolves by hostname:
//   - A hotel's own domain → that hotel's path-scoped booking site (/<slug>).
//   - Everything else (the platform host tech.rockenue.com, Railway/localhost)
//     → the Rockenue Tech storefront/landing page (which has an Admin button
//     → /admin). The admin is reached via that button, never auto-redirected.
// Per-hotel sites are always also reachable directly at /<slug>; /admin + /api
// work on every host.
export default async function RootPage() {
  const h = await headers();
  const host = (h.get("x-property-host") ?? h.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();

  if (host) {
    const [hotel] = await db
      .select({ slug: properties.slug })
      .from(properties)
      .where(eq(properties.domain, host))
      .limit(1);
    if (hotel) redirect(`/${hotel.slug}`);
  }

  return <RockenueLanding />;
}
