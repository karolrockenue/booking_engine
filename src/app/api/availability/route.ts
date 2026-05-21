import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeAvailability } from "@/lib/booking/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const adults = parseInt(searchParams.get("adults") ?? "1");

  if (!propertyId || !checkIn || !checkOut) {
    return NextResponse.json(
      { error: "Missing propertyId, checkIn, or checkOut" },
      { status: 400 }
    );
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  if (nights < 1) {
    return NextResponse.json(
      { error: "checkOut must be after checkIn" },
      { status: 400 }
    );
  }

  // Per-property cache tag so syncInventoryForProperty(propId) only flushes
  // entries for that property. revalidate=30 caps staleness if a sync
  // somehow misses (e.g. a bug skips revalidateTag).
  const cached = unstable_cache(
    () => computeAvailability(propertyId, checkIn, checkOut, adults),
    ["availability", propertyId, checkIn, checkOut, String(adults)],
    {
      revalidate: 30,
      tags: [`availability:${propertyId}`],
    }
  );

  const results = await cached();
  return NextResponse.json({ results });
}
