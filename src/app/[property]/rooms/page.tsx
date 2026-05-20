import { resolvePropertyBySlug, getPropertyPhotos } from "@/lib/get-property";
import { notFound, redirect } from "next/navigation";
import { RoomsClient } from "./rooms-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoRoomSelect } from "@/themes/portico/screens/RoomSelect";

export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ property: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  if (!property) notFound();

  const sp = await searchParams;
  const checkIn = pickStr(sp.checkIn);
  const checkOut = pickStr(sp.checkOut);

  const portico = await activePorticoTokens();
  if (portico) {
    if (!checkIn || !checkOut) redirect(`/${slug}/book`);
    const adults = parseInt(pickStr(sp.adults) ?? "2", 10) || 2;
    const children = parseInt(pickStr(sp.children) ?? "0", 10) || 0;
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

  if (!checkIn || !checkOut) redirect(`/${slug}`);
  return <RoomsClient property={property} />;
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
