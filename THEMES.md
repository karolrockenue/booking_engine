# Themes — multi-design deployments

The booking engine ships **one codebase, many designs**. The look/layout of the public-facing flow (`/`, `/rooms`, `/book`, `/checkout`, `/confirmation`) is selected per Railway service via the `THEME` env var. Backend, database, Cloudbeds, Stripe, and email are identical across every deployment.

Today there are two themes:

| `THEME`           | Design                                  | Components                              |
|-------------------|-----------------------------------------|-----------------------------------------|
| `default` (unset) | Original live design                    | `src/app/*` (current pages)             |
| `portico-ivory`   | The Portico Hotel — Editorial Ivory     | `src/themes/portico/screens/*`          |

The Portico components are token-driven via `src/themes/portico/tokens.ts`, so adding a future palette variant is a token-only change.

## Per-deployment setup on Railway

For each new design link:

1. **Create a new Railway service** that points at the same GitHub repo as the live one.
2. **Reuse all existing env vars** from the live service (DATABASE_URL, CLOUDBEDS_*, STRIPE_*, SENDGRID_*, etc.). Same backend, same data.
3. **Add one extra env var** on the new service:
   ```
   THEME=portico-ivory
   ```
4. **Map a domain** (Railway-provided `*.up.railway.app` is fine for testing).
5. Deploy. The service serves the Portico flow; admin/internal routes (`/admin`, `/bars`, `/compare*`, `/pickers`, `/rates`, `/rooms-mockup`, `/enhance`, `/fonts`) remain identical across every deployment.

The active theme is read at request time from `process.env.THEME` (see `src/lib/active-theme.ts`). Restart the Railway service after changing it.

## Local preview — flipping between themes without restarting

Run `npm run dev` once. Then visit `http://localhost:3000/dev/themes` and pick a theme — it sets a session cookie and reloads the homepage in that design. Every Portico screen also has a small floating badge in the bottom-right that links back to `/dev/themes`. Cookie persists for 30 days; clear with the link on `/dev/themes` or by deleting cookies for `localhost`.

The dev cookie has **no effect in production**: on Railway the env var is the only source of truth, so accidentally setting the cookie in a deployed build does nothing.

## Adding a new theme

1. Create `src/themes/<slug>/` with `tokens.ts`, screens, and shared components.
2. Add the slug to `PORTICO_THEMES` in `src/lib/active-theme.ts` (or extend the `ActiveTheme` union if it's not Portico).
3. In each public-route page (`src/app/page.tsx`, `rooms/page.tsx`, `book/page.tsx`, `checkout/page.tsx`, `confirmation/page.tsx`), add a branch that returns your new theme's component when `getActiveTheme()` matches.
4. Add the theme to the table above.
5. Spin up a Railway service with `THEME=<slug>`.

## What's themed vs. shared

**Themed (per-deployment):**
- Public marketing & booking flow: `/`, `/rooms`, `/book`, `/checkout`, `/confirmation`
- Photography (Portico themes use `public/portico/*.jpg` regardless of which property is connected)

**Shared (identical across every deployment):**
- All API routes (`src/app/api/*`)
- Database schema, Cloudbeds sync, Stripe Connect, webhooks, email
- Headless booking hooks (`useAvailability`, `useBookingDraft`, `usePersistedDraft`, `submitBooking`)
- Admin dashboard (`/admin`)
- Internal/dev routes (`/bars`, `/compare`, `/compare-live`, `/pickers`, `/rates`, `/rooms-mockup`, `/enhance`, `/fonts`)

## Notes on the Portico themes (testing phase)

- The Portico marketing copy ("The Portico Hotel", Paddington W2 eyebrow, room descriptions, etc.) is currently hardcoded in `src/themes/portico/screens/*`. The booking data (room types, availability, rate plans) comes from whichever property is plugged in via Cloudbeds — so a deployment of `THEME=portico-ivory` against the rockenue demo property will show Portico chrome around real demo-property availability.
- Photos in `public/portico/` are the web-resized assets from `design_handoff_portico_direction_c/img/`. Replace with property-specific photos if/when the Portico themes are pointed at the real Portico hotel.
- The Stripe Payment Element keeps its own Stripe-default appearance for now; theming the element itself is a follow-up.
