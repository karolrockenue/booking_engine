import { NextRequest, NextResponse } from "next/server";

const SHARED_SECRET = process.env.B2U_SHARED_SECRET;

export function verifyB2URequest(req: NextRequest, body: Record<string, unknown>) {
  const secret = body.shared_secret as string | undefined;
  if (!SHARED_SECRET || secret !== SHARED_SECRET) {
    return NextResponse.json(
      { success: false, error: "Invalid shared_secret" },
      { status: 401 }
    );
  }
  return null; // auth passed
}
