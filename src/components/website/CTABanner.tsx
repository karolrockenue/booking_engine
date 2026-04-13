"use client";

interface CTABannerProps {
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaTarget?: string;
}

export function CTABanner({
  headline,
  subheadline,
  ctaText,
  ctaTarget = "/book",
}: CTABannerProps) {
  return (
    <section
      className="py-20"
      style={{ backgroundColor: "var(--color-secondary)" }}
    >
      <div
        className="mx-auto text-center"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        <h2
          className="text-3xl md:text-4xl mb-4"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
            letterSpacing: "var(--font-heading-letter-spacing)",
            color: "#FFFFFF",
          }}
        >
          {headline}
        </h2>
        {subheadline && (
          <p
            className="text-lg mb-8 max-w-xl mx-auto"
            style={{
              fontFamily: "var(--font-body)",
              color: "rgba(255,255,255,0.85)",
              lineHeight: "var(--font-body-line-height)",
            }}
          >
            {subheadline}
          </p>
        )}
        <a
          href={ctaTarget}
          className="inline-block px-10 py-4 text-sm uppercase tracking-widest transition-colors"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "600",
            borderRadius: "var(--radius-button)",
            backgroundColor: "#FFFFFF",
            color: "var(--color-secondary)",
          }}
        >
          {ctaText}
        </a>
      </div>
    </section>
  );
}
