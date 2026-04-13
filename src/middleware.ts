import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const { pathname, searchParams } = req.nextUrl;

  // Skip for API routes, static files, admin
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
