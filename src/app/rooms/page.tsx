import { resolveProperty, getPropertyPhotos } from "@/lib/get-property";
import { notFound, redirect } from "next/navigation";
import { RoomsClient } from "./rooms-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoRoomSelect } from "@/themes/portico/screens/RoomSelect";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const property = await resolveProperty();
  if (!property) notFound();

  const params = await searchParams;
  const checkIn = pickStr(params.checkIn);
  const checkOut = pickStr(params.checkOut);

  const portico = await activePorticoTokens();
  if (portico) {
    if (!checkIn || !checkOut) redirect("/book");
    const adults = parseInt(pickStr(params.adults) ?? "2", 10) || 2;
    const children = parseInt(pickStr(params.children) ?? "0", 10) || 0;
    const photos = await getPropertyPhotos(property.id);
    return (
      <PorticoRoomSelect
        t={portico}
        property={property}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        children={children}
        photos={photos}
      />
    );
  }

  if (!checkIn || !checkOut) redirect("/");
  return <RoomsClient property={property} />;
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
