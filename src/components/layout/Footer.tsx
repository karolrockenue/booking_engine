"use client";

import { useTheme } from "@/components/layout/ThemeProvider";

export function Footer() {
  const theme = useTheme();
  const contact = theme.contact;
  const social = theme.social;

  return (
    <footer
      style={{
        backgroundColor: "var(--color-primary)",
        color: "rgba(255,255,255,0.8)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        className="mx-auto py-16 grid gap-8 md:grid-cols-3"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        <div>
          <h3
            className="text-xl mb-4"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
              color: "#FFFFFF",
            }}
          >
            {theme.name}
          </h3>
          {contact?.address && (
            <p className="text-sm leading-relaxed">{contact.address}</p>
          )}
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-wider mb-4 text-white font-semibold">
            Contact
          </h4>
          <div className="flex flex-col gap-2 text-sm">
            {contact?.phone && (
              <a href={`tel:${contact.phone}`} className="hover:text-white transition-colors">
                {contact.phone}
              </a>
            )}
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="hover:text-white transition-colors">
                {contact.email}
              </a>
            )}
          </div>
        </div>

        <div>
          {(social?.instagram || social?.facebook || social?.tripadvisor) && (
            <>
              <h4 className="text-sm uppercase tracking-wider mb-4 text-white font-semibold">
                Follow Us
              </h4>
              <div className="flex gap-4 text-sm">
                {social.instagram && (
                  <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Instagram
                  </a>
                )}
                {social.facebook && (
                  <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Facebook
                  </a>
                )}
                {social.tripadvisor && (
                  <a href={social.tripadvisor} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    TripAdvisor
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="border-t border-white/10 py-6 text-center text-xs"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        <div
          className="mx-auto"
          style={{
            maxWidth: "var(--layout-max-width)",
            paddingLeft: "var(--container-padding)",
            paddingRight: "var(--container-padding)",
          }}
        >
          &copy; {new Date().getFullYear()} {theme.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
