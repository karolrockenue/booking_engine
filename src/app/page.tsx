import { headers } from "next/headers";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RockenueLanding } from "@/components/rockenue/Landing";

// Bare "/" resolves by host:
//   - If a hotel owns this exact host (its custom domain), send guests to that
//     hotel's path-scoped site so the slug is visible and downstream pages
//     resolve from the path.
//   - Otherwise this is the platform host (e.g. app.rockenue.tech) → render the
//     Rockenue Tech landing page (Admin button → /admin).
// Per-hotel sites are always also reachable at /<slug>.
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
