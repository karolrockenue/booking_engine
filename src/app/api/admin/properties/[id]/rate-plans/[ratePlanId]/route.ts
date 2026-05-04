import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { ratePlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface CancellationPolicy {
  deadlineHours?: number;
  penaltyType?: "first_night" | "full_stay" | "percent" | "none";
  penaltyPercent?: number;
  note?: string;
}

interface PatchBody {
  isRefundable?: boolean;
  cancellationPolicy?: CancellationPolicy | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ratePlanId: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId, ratePlanId } = await params;
  const body = (await req.json()) as PatchBody;

  const updates: Record<string, unknown> = {};
  if (body.isRefundable !== undefined) updates.isRefundable = body.isRefundable;
  if (body.cancellationPolicy !== undefined) {
    updates.cancellationPolicy = body.cancellationPolicy;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(ratePlans)
    .set(updates)
    .where(
      and(eq(ratePlans.id, ratePlanId), eq(ratePlans.propertyId, propertyId))
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Rate plan not found for this property" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}
