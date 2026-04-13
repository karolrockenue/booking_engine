"use client";

interface Testimonial {
  quote: string;
  author: string;
  source?: string;
  rating?: number;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  limit?: number;
  sectionTitle?: string;
}

export function TestimonialsSection({
  testimonials,
  limit = 3,
  sectionTitle = "What Our Guests Say",
}: TestimonialsSectionProps) {
  const displayed = testimonials.slice(0, limit);

  return (
    <section
      className="py-[var(--section-padding)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        {sectionTitle && (
          <h2
            className="text-3xl md:text-4xl mb-12 text-center"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
              letterSpacing: "var(--font-heading-letter-spacing)",
              color: "var(--color-text)",
            }}
          >
            {sectionTitle}
          </h2>
        )}

        <div className="grid gap-8 md:grid-cols-3">
          {displayed.map((t, i) => (
            <div
              key={i}
              className="p-8"
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Stars */}
              {t.rating && (
                <div className="mb-4" style={{ color: "var(--color-secondary)" }}>
                  {"★".repeat(t.rating)}
                  {"☆".repeat(5 - t.rating)}
                </div>
              )}

              <blockquote
                className="text-base mb-6 italic"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text)",
                  lineHeight: "var(--font-body-line-height)",
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  {t.author}
                </p>
                {t.source && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t.source}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
