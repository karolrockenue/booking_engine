import { resolvePropertyBySlug, getPropertyPhotos } from "@/lib/get-property";
import { notFound, redirect } from "next/navigation";
import { RoomsClient } from "./rooms-client";
import { activePorticoTokens } from "@/themes/portico";
import { PorticoRoomSelect } from "@/themes/portico/screens/RoomSelect";
import { activeStreetTokens } from "@/themes/street";
import { StreetRoomSelect } from "@/themes/street/screens/RoomSelect";
import { activeEditorialCalmTokens } from "@/themes/editorial-calm";
import { EditorialCalmRoomSelect } from "@/themes/editorial-calm/screens/RoomSelect";
import { buildHotelJsonLd } from "@/lib/google-hotels/hotel-json-ld";

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
  const adults = parseInt(pickStr(sp.adults) ?? "2", 10) || 2;
  const children = parseInt(pickStr(sp.children) ?? "0", 10) || 0;

  const portico = await activePorticoTokens(property.templateSlug);
  if (portico) {
    if (!checkIn || !checkOut) redirect(`/${slug}/book`);
    const [photos, jsonLd] = await Promise.all([
      getPropertyPhotos(property.id),
      buildHotelJsonLd({ property, checkIn, checkOut, adults }),
    ]);
    return (
      <>
        <JsonLd data={jsonLd} />
        <PorticoRoomSelect
          t={portico}
          property={property}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          children={children}
          photos={photos}
        />
      </>
    );
  }

  const street = await activeStreetTokens(property.templateSlug);
  if (street) {
    if (!checkIn || !checkOut) redirect(`/${slug}`);
    const [photos, jsonLd] = await Promise.all([
      getPropertyPhotos(property.id),
      buildHotelJsonLd({ property, checkIn, checkOut, adults }),
    ]);
    return (
      <>
        <JsonLd data={jsonLd} />
        <StreetRoomSelect
          t={street}
          property={property}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          children={children}
          photos={photos}
        />
      </>
    );
  }

  const editorialCalm = await activeEditorialCalmTokens(property.templateSlug);
  if (editorialCalm) {
    if (!checkIn || !checkOut) redirect(`/${slug}`);
    const [photos, jsonLd] = await Promise.all([
      getPropertyPhotos(property.id),
      buildHotelJsonLd({ property, checkIn, checkOut, adults }),
    ]);
    return (
      <>
        <JsonLd data={jsonLd} />
        <EditorialCalmRoomSelect
          t={editorialCalm}
          property={property}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          children={children}
          photos={photos}
        />
      </>
    );
  }

  if (!checkIn || !checkOut) redirect(`/${slug}`);
  const jsonLd = await buildHotelJsonLd({ property, checkIn, checkOut, adults });
  return (
    <>
      <JsonLd data={jsonLd} />
      <RoomsClient property={property} />
    </>
  );
}

// Server-rendered hotel-price structured data so crawlers see it. Theme-agnostic
// — lives in the shared route, not per theme. See Google blueprint §11.
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
