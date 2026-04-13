"use client";

import { useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/website/HeroSection";
import type { ResolvedProperty } from "@/lib/get-property";

export function HomeClient({ property }: { property: ResolvedProperty }) {
  const router = useRouter();

  function handleSearch(checkIn: string, checkOut: string, adults: number) {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: adults.toString(),
    });
    router.push(`/rooms?${params}`);
  }

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar />
      <main>
        <HeroSection onSearch={handleSearch} />
      </main>
      <Footer />
    </ThemeProvider>
  );
}
