import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import {
  properties,
  inventory,
  cloudbedsWebhookSubscriptions,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { SCOPES } from "@/lib/cloudbeds/scopes";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [lastSyncRow, subs] = await Promise.all([
    db
      .select({ lastSync: sql<Date | null>`max(${inventory.updatedAt})` })
      .from(inventory)
      .where(eq(inventory.propertyId, id)),
    db
      .select({
        id: cloudbedsWebhookSubscriptions.id,
        cloudbedsSubscriptionId:
          cloudbedsWebhookSubscriptions.cloudbedsSubscriptionId,
        object: cloudbedsWebhookSubscriptions.object,
        action: cloudbedsWebhookSubscriptions.action,
        createdAt: cloudbedsWebhookSubscriptions.createdAt,
      })
      .from(cloudbedsWebhookSubscriptions)
      .where(eq(cloudbedsWebhookSubscriptions.propertyId, id)),
  ]);

  return NextResponse.json({
    connected: !!property.cloudbedsAccessToken,
    cloudbedsPropertyId: property.cloudbedsPropertyId,
    tokenExpiresAt: property.cloudbedsTokenExpiresAt,
    scopes: SCOPES,
    lastSyncedAt: lastSyncRow[0]?.lastSync ?? null,
    webhooks: subs.map((s) => ({
      id: s.id,
      cloudbedsSubscriptionId: s.cloudbedsSubscriptionId,
      event: `${s.object}/${s.action}`,
      createdAt: s.createdAt,
    })),
  });
}
