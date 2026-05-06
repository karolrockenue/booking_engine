import { NextResponse } from "next/server";
import { DEV_THEME_COOKIE } from "@/lib/active-theme";

// GET /dev/themes/clear — drops the dev override cookie and bounces to /dev/themes.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/dev/themes", url.origin), 303);
  res.cookies.delete(DEV_THEME_COOKIE);
  return res;
}
