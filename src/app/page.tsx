import { headers } from "next/headers";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RockenueLanding } from "@/components/rockenue/Landing";

// Hosts the admin application lives on; a bare visit there goes straight to
// /admin. Comma-separated env override; default covers the platform host
// (tech.rockenue.com) + the legacy one during the transition.
const APP_HOSTS = (
  process.env.PLATFORM_APP_HOSTS ?? "tech.rockenue.com,app.rockenue.tech"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Bare "/" resolves by hostname:
//   - A hotel's own domain → that hotel's path-scoped booking site (/<slug>).
//   - The app host (app.rockenue.tech) → the admin area (/admin).
//   - Everything else (apex rockenue.tech, www, Railway/localhost) → the
//     Rockenue Tech marketing landing page.
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

  if (APP_HOSTS.includes(host)) redirect("/admin");

  return <RockenueLanding />;
}
