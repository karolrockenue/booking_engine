import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authError = verifyB2URequest(req, body);
  if (authError) return authError;

  return NextResponse.json({ success: true });
}
