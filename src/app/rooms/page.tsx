import { resolveProperty } from "@/lib/get-property";
import { notFound, redirect } from "next/navigation";
import { RoomsClient } from "./rooms-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoRoomsIndex } from "@/themes/portico/screens/RoomsIndex";
import { PorticoRoomSelect } from "@/themes/portico/screens/RoomSelect";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const property = await resolveProperty();
  if (!property) notFound();

  const portico = await activePorticoTokens();
  if (portico) {
    const params = await searchParams;
    const checkIn = pickStr(params.checkIn);
    const checkOut = pickStr(params.checkOut);
    if (!checkIn || !checkOut) {
      return <PorticoRoomsIndex t={portico} />;
    }
    const adults = parseInt(pickStr(params.adults) ?? "2", 10) || 2;
    const children = parseInt(pickStr(params.children) ?? "0", 10) || 0;
    return (
      <PorticoRoomSelect
        t={portico}
        property={property}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        children={children}
      />
    );
  }

  // Default theme: legacy rooms-results page (redirects to / if no dates).
  const params = await searchParams;
  if (!pickStr(params.checkIn) || !pickStr(params.checkOut)) {
    redirect("/");
  }
  return <RoomsClient property={property} />;
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
