import Script from "next/script";
import { resolvePropertyBySlug } from "@/lib/get-property";
import { CookieConsent } from "@/components/storefront/CookieConsent";

// Wraps every storefront page for a property. When the hotel has a GA4
// Measurement ID configured, it loads Google Analytics with Consent Mode v2
// (default denied) and mounts the consent banner, which flips analytics on
// only after the guest accepts. No ID → no analytics and no banner.
export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;
  const property = await resolvePropertyBySlug(slug);
  const gaId = property?.gaMeasurementId ?? null;

  return (
    <>
      {gaId && (
        <>
          <Script
            id="ga-consent-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('consent', 'default', {
                  'analytics_storage': 'denied',
                  'ad_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied'
                });
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `,
            }}
          />
          <Script
            id="ga-lib"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          />
        </>
      )}

      {children}

      {gaId && <CookieConsent cookiePolicyHref={`/${slug}/legal/cookies`} />}
    </>
  );
}
