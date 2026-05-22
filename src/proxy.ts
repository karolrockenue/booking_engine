import { NextRequest, NextResponse } from "next/server";

const DEV_MOCKUP_ROUTES = [
  "/bars",
  "/compare",
  "/compare-live",
  "/enhance",
  "/fonts",
  "/pickers",
  "/rates",
  "/rooms-mockup",
];

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // Retired platform domain → permanent redirect to the new home
  // (tech.rockenue.com), preserving the path. Covers the apex + any subdomain.
  const bareHost = host.split(":")[0].toLowerCase();
  if (bareHost === "rockenue.tech" || bareHost.endsWith(".rockenue.tech")) {
    const url = new URL(req.nextUrl);
    url.host = "tech.rockenue.com";
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Dev mockup pages are not part of the production booking flow. 404 them in
  // production rather than relying on people remembering to delete the
  // directories.
  if (process.env.NODE_ENV === "production") {
    for (const route of DEV_MOCKUP_ROUTES) {
      if (pathname === route || pathname.startsWith(`${route}/`)) {
        return new NextResponse(null, { status: 404 });
      }
    }
  }

  // Skip property resolution for API routes, static files, admin
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("x-property-host", host);

  // Dev convenience: ?property=slug overrides domain resolution
  const slugOverride = searchParams.get("property");
  if (slugOverride) {
    response.headers.set("x-property-slug", slugOverride);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|admin).*)"],
};
