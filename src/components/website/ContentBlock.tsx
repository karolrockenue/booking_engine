"use client";

interface ContentBlockProps {
  headline?: string;
  body: string;
  imageUrl?: string;
  layout?: "text-left-image-right" | "text-right-image-left" | "stacked" | "text-only";
}

export function ContentBlock({
  headline,
  body,
  imageUrl,
  layout = "text-left-image-right",
}: ContentBlockProps) {
  if (layout === "text-only" || !imageUrl) {
    return (
      <section
        className="py-[var(--section-padding)]"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div
          className="mx-auto max-w-3xl text-center"
          style={{
            paddingLeft: "var(--container-padding)",
            paddingRight: "var(--container-padding)",
          }}
        >
          {headline && (
            <h2
              className="text-3xl md:text-4xl mb-6"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                letterSpacing: "var(--font-heading-letter-spacing)",
                color: "var(--color-text)",
              }}
            >
              {headline}
            </h2>
          )}
          <p
            className="text-base md:text-lg"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--font-body-line-height)",
            }}
          >
            {body}
          </p>
        </div>
      </section>
    );
  }

  if (layout === "stacked") {
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
          <div
            className="w-full aspect-[3/2] bg-cover bg-center mb-8"
            style={{
              backgroundImage: `url(${imageUrl})`,
              borderRadius: "var(--radius-card)",
            }}
          />
          <div className="max-w-3xl mx-auto text-center">
            {headline && (
              <h2
                className="text-3xl md:text-4xl mb-6"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                  letterSpacing: "var(--font-heading-letter-spacing)",
                  color: "var(--color-text)",
                }}
              >
                {headline}
              </h2>
            )}
            <p
              className="text-base md:text-lg"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
                lineHeight: "var(--font-body-line-height)",
              }}
            >
              {body}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Side by side
  const imageFirst = layout === "text-right-image-left";

  return (
    <section
      className="py-[var(--section-padding)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div
        className={`mx-auto grid gap-12 md:grid-cols-2 items-center ${imageFirst ? "" : ""}`}
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        <div className={imageFirst ? "md:order-2" : ""}>
          {headline && (
            <h2
              className="text-3xl md:text-4xl mb-6"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                letterSpacing: "var(--font-heading-letter-spacing)",
                color: "var(--color-text)",
              }}
            >
              {headline}
            </h2>
          )}
          <p
            className="text-base md:text-lg"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--font-body-line-height)",
            }}
          >
            {body}
          </p>
        </div>
        <div className={imageFirst ? "md:order-1" : ""}>
          <div
            className="w-full aspect-[3/2] bg-cover bg-center"
            style={{
              backgroundImage: `url(${imageUrl})`,
              borderRadius: "var(--radius-card)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
