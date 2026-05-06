import { NextResponse } from "next/server";
import { DEV_THEME_COOKIE, isValidTheme } from "@/lib/active-theme";

// GET /dev/themes/set?theme=portico-ivory&next=/rooms
//
// Sets a cookie that overrides the THEME env var on this dev server, then
// redirects to ?next= (default /). In production the cookie is set anyway but
// has no effect — getActiveTheme() ignores it outside dev.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const theme = url.searchParams.get("theme") ?? "";
  const next = url.searchParams.get("next") ?? "/";

  if (!isValidTheme(theme)) {
    return NextResponse.json(
      { error: "invalid theme", got: theme, expected: ["default", "portico-ivory"] },
      { status: 400 }
    );
  }

  // Only allow same-origin redirects.
  const safeNext = next.startsWith("/") ? next : "/";
  const redirectTo = new URL(safeNext, url.origin);

  const res = NextResponse.redirect(redirectTo, 303);
  res.cookies.set(DEV_THEME_COOKIE, theme, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
