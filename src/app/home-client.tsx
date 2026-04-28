"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/website/HeroSection";
import { FadeIn } from "@/components/ui/FadeIn";
import type { ResolvedProperty } from "@/lib/get-property";
import {
  Wifi, Coffee, Dumbbell, UtensilsCrossed, MapPin, CheckCircle2,
} from "lucide-react";

export function HomeClient({ property }: { property: ResolvedProperty }) {
  const router = useRouter();
  const theme = property.theme;

  function handleSearch(checkIn: string, checkOut: string, adults: number, children: number, rooms: number) {
    router.push(`/rooms?${new URLSearchParams({ checkIn, checkOut, adults: adults.toString(), children: children.toString(), rooms: rooms.toString() })}`);
  }

  const gallery = [
    { src: "/hotel/gallery-facade.jpg", alt: "Hotel exterior" },
    { src: "/hotel/gallery-room.jpg", alt: "Deluxe bedroom" },
    { src: "/hotel/gallery-reception.jpg", alt: "Reception & lobby" },
    { src: "/hotel/gallery-dining.jpg", alt: "Restaurant dining" },
    { src: "/hotel/gallery-lounge.jpg", alt: "Guest lounge" },
    { src: "/hotel/gallery-bathroom.jpg", alt: "En-suite bathroom" },
  ];

  const amenities = [
    { label: "Complimentary WiFi", desc: "High-speed throughout", icon: Wifi },
    { label: "Breakfast Included", desc: "Full English or continental", icon: Coffee },
    { label: "Fitness Centre", desc: "24/7 access", icon: Dumbbell },
    { label: "On-site Dining", desc: "Restaurant & bar", icon: UtensilsCrossed },
    { label: "Prime Location", desc: "Steps from Hyde Park", icon: MapPin },
    { label: "24/7 Concierge", desc: "At your service", icon: CheckCircle2 },
  ];

  const policies = [
    "Free cancellation up to 48 hours before arrival",
    "No prepayment required — pay at property",
    "Instant confirmation with flexible booking",
    "Best rate guaranteed when you book direct",
  ];

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar hideCta />
      <main>
        <HeroSection onSearch={handleSearch} />

        {/* ── Accent bar ── */}
        <div style={{ backgroundColor: "var(--color-primary)" }}>
          <div className="mx-auto py-4 flex items-center justify-between" style={{ maxWidth: "var(--layout-max-width)", paddingLeft: "var(--container-padding)", paddingRight: "var(--container-padding)" }}>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{theme.name}</p>
            <div className="flex items-center gap-6">
              {theme.contact?.phone && <a href={`tel:${theme.contact.phone}`} className="text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.5)" }}>{theme.contact.phone}</a>}
              <p className="text-xs hidden md:block" style={{ color: "rgba(255,255,255,0.5)" }}>Book direct for the best rate</p>
            </div>
          </div>
        </div>

        {/* ── About ── */}
        <section className="py-20 md:py-28 px-4" style={{ backgroundColor: "#fff" }}>
          <FadeIn>
            <div className="max-w-4xl mx-auto grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-start">
              <div>
                <h2 className="text-2xl md:text-3xl mb-3" style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
                  {theme.name}
                </h2>
                <div className="h-px w-10 mb-3" style={{ backgroundColor: "var(--color-primary)" }} />
                <div className="flex gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <span>Kensington, London</span><span>·</span><span>Est. 1860</span>
                </div>
              </div>
              <div>
                <p className="text-sm mb-4" style={{ color: "var(--color-text)", lineHeight: 1.8 }}>
                  Tucked away on a quiet, tree-lined square in the heart of Kensington, The Kensington Arms offers an intimate retreat just moments from Hyde Park, the Royal Albert Hall, and some of London&apos;s finest museums.
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)", lineHeight: 1.8 }}>
                  Originally built as a Georgian townhouse in 1860, the property has been thoughtfully restored to blend period character — ornate cornicing, marble fireplaces, sash windows — with every modern comfort.
                </p>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── Gallery ── */}
        <section className="pb-20 md:pb-28 px-4" style={{ backgroundColor: "#fff" }}>
          <div className="max-w-6xl mx-auto">
            <FadeIn>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div className="col-span-2 overflow-hidden rounded-lg relative" style={{ aspectRatio: "4/3" }}>
                  <Image src={gallery[0].src} alt={gallery[0].alt} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 66vw" />
                </div>
                <div className="col-span-2 md:col-span-1 grid grid-cols-2 md:flex md:flex-col gap-3">
                  {gallery.slice(1, 3).map((img, i) => (
                    <div key={i} className="overflow-hidden rounded-lg relative flex-1" style={{ aspectRatio: "3/2" }}>
                      <Image src={img.src} alt={img.alt} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 50vw, 33vw" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {gallery.slice(3).map((img, i) => (
                  <div key={i} className="overflow-hidden rounded-lg relative" style={{ aspectRatio: "3/2" }}>
                    <Image src={img.src} alt={img.alt} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="33vw" />
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Amenities ── */}
        <section className="py-20 md:py-28 px-4" style={{ backgroundColor: "#F2F2F2" }}>
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "var(--color-primary)", fontWeight: 600 }}>What&apos;s Included</p>
                <h2 className="text-2xl md:text-3xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--color-text)" }}>Amenities &amp; Services</h2>
              </div>
            </FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {amenities.map((a, i) => (
                <FadeIn key={a.label} delay={i * 60}>
                  <div className="flex items-center gap-4 p-5 rounded-lg bg-white hover:shadow-md transition-shadow" style={{ border: "1px solid #e8e8e8" }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                      <a.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{a.label}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{a.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Location ── */}
        <section className="py-20 md:py-28 px-4" style={{ backgroundColor: "#fff" }}>
          <div className="max-w-6xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "var(--color-primary)", fontWeight: 600 }}>Find Us</p>
                <h2 className="text-2xl md:text-3xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--color-text)" }}>Location</h2>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: "1px solid #e8e8e8" }}>
                <div className="grid md:grid-cols-[1fr_1.6fr]">
                  <div className="p-8 md:p-10 flex flex-col justify-between" style={{ backgroundColor: "#fafafa" }}>
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>In the Heart of Kensington</h3>
                      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)", lineHeight: 1.8 }}>
                        {theme.contact?.address || "Central London"}. A quiet residential square, yet moments from everything — the Palace, the Park, the museums.
                      </p>
                      <div className="flex flex-col gap-2 mb-8">
                        {theme.contact?.phone && <a href={`tel:${theme.contact.phone}`} className="text-sm hover:underline" style={{ color: "var(--color-primary)" }}>{theme.contact.phone}</a>}
                        {theme.contact?.email && <a href={`mailto:${theme.contact.email}`} className="text-sm hover:underline" style={{ color: "var(--color-primary)" }}>{theme.contact.email}</a>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>Nearby</p>
                      {[
                        { place: "Kensington Palace", time: "5 min walk" },
                        { place: "Hyde Park", time: "8 min walk" },
                        { place: "Natural History Museum", time: "12 min walk" },
                        { place: "Heathrow Airport", time: "35 min drive" },
                      ].map((item, i) => (
                        <div key={item.place} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < 3 ? "1px solid #ececec" : "none" }}>
                          <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{item.place}</span>
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(theme.contact?.address || theme.name)}&output=embed&z=15`}
                      className="w-full h-full border-0"
                      style={{ minHeight: "480px" }}
                      loading="lazy"
                      title="Hotel location"
                    />
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Why Book Direct — single navy section ── */}
        <section className="py-20 md:py-28 px-4" style={{ backgroundColor: "var(--color-primary)" }}>
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Why Book Direct</p>
                <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>The Best Rate, Guaranteed</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {[
                  { title: "Best Price Promise", desc: "Our direct rates are always equal to or lower than any OTA. Find it cheaper and we'll match it." },
                  { title: "Free Cancellation", desc: "Most rates offer free cancellation up to 48 hours before arrival — no questions asked." },
                  { title: "No Hidden Fees", desc: "The price you see is the price you pay. Taxes and charges included upfront." },
                ].map((item, i) => (
                  <FadeIn key={item.title} delay={i * 100}>
                    <div className="p-6 rounded-lg h-full" style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <CheckCircle2 className="w-5 h-5 mb-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                      <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{item.desc}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Policies + CTA ── */}
        <section className="py-20 md:py-28 px-4" style={{ backgroundColor: "#fff" }}>
          <div className="max-w-3xl mx-auto">
            <FadeIn>
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-4 mb-12">
                {policies.map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#059669" }} />
                    <p className="text-sm" style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>{p}</p>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <a
                  href="#top"
                  onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="inline-block px-10 py-4 text-sm uppercase tracking-widest transition-colors rounded"
                  style={{ fontWeight: 600, backgroundColor: "var(--color-primary)", color: "#fff" }}
                >
                  Check Availability
                </a>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
