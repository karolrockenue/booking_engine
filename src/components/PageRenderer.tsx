"use client";

import type { PageSection } from "@/lib/theme";
import { HeroSection } from "./website/HeroSection";
import { ContentBlock } from "./website/ContentBlock";
import { RoomShowcase } from "./website/RoomShowcase";
import { AmenitiesGrid } from "./website/AmenitiesGrid";
import { Gallery } from "./website/Gallery";
import { TestimonialsSection } from "./website/TestimonialsSection";
import { LocationMap } from "./website/LocationMap";
import { ContactSection } from "./website/ContactSection";
import { CTABanner } from "./website/CTABanner";
import { BookingWidget } from "./booking/BookingWidget";

const componentMap: Record<string, React.ComponentType<any>> = {
  HeroSection,
  ContentBlock,
  RoomShowcase,
  AmenitiesGrid,
  Gallery,
  TestimonialsSection,
  LocationMap,
  ContactSection,
  CTABanner,
  BookingWidget,
};

interface PageRendererProps {
  sections: PageSection[];
}

export function PageRenderer({ sections }: PageRendererProps) {
  return (
    <>
      {sections.map((section, i) => {
        const Component = componentMap[section.component];
        if (!Component) {
          console.warn(`Unknown component: ${section.component}`);
          return null;
        }
        return <Component key={`${section.component}-${i}`} {...section.props} />;
      })}
    </>
  );
}
