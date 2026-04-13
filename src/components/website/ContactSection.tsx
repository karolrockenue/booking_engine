"use client";

import { useState, type FormEvent } from "react";

interface ContactSectionProps {
  address?: string;
  phone?: string;
  email?: string;
  sectionTitle?: string;
}

export function ContactSection({
  address,
  phone,
  email,
  sectionTitle = "Contact Us",
}: ContactSectionProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // For now just show a success message
    // Real implementation would post to an API route
    setSubmitted(true);
  }

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

        <div className="grid gap-12 md:grid-cols-2">
          {/* Contact info */}
          <div>
            <h3
              className="text-xl mb-6"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                color: "var(--color-text)",
              }}
            >
              Get in Touch
            </h3>
            <div
              className="flex flex-col gap-4 text-base"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
                lineHeight: "var(--font-body-line-height)",
              }}
            >
              {address && <p>{address}</p>}
              {phone && (
                <p>
                  <a href={`tel:${phone}`} className="hover:underline">
                    {phone}
                  </a>
                </p>
              )}
              {email && (
                <p>
                  <a href={`mailto:${email}`} className="hover:underline">
                    {email}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Contact form */}
          <div>
            {submitted ? (
              <div
                className="p-8 text-center"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p
                  className="text-lg font-semibold mb-2"
                  style={{ color: "var(--color-success)" }}
                >
                  Thank you!
                </p>
                <p style={{ color: "var(--color-text-muted)" }}>
                  We&apos;ll be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  required
                  className="px-4 py-3 text-sm"
                  style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-text)",
                  }}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  className="px-4 py-3 text-sm"
                  style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-text)",
                  }}
                />
                <textarea
                  name="message"
                  placeholder="Your Message"
                  required
                  rows={4}
                  className="px-4 py-3 text-sm resize-none"
                  style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-text)",
                  }}
                />
                <button
                  type="submit"
                  className="px-8 py-3 text-sm uppercase tracking-widest transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: "600",
                    borderRadius: "var(--radius-button)",
                    backgroundColor: "var(--color-primary)",
                    color: "#FFFFFF",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
