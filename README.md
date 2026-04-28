# Booking Engine

Multi-tenant hotel website + booking engine platform. Each hotel runs on its own custom domain with a bespoke website and an integrated booking flow connected to Cloudbeds. Built and managed by Rockenue as the webmaster across all properties.

## Docs

- **`hotel-platform-build-plan.md`** — current state of the platform (architecture, what's built, design conventions, file structure).
- **`TODO.md`** — live, sequenced build plan for the integration rebuild (Cloudbeds REST API + Stripe Connect).
- **`AGENTS.md` / `CLAUDE.md`** — instructions for AI agents working in this repo.

## Local dev

```bash
npm install
npm run dev
# → http://localhost:3000 (resolves to first property in DB)
# → http://localhost:3000/?property=urbanstay (switch property)
```

Requires `DATABASE_URL` in `.env.local` pointing at the Neon Postgres instance.

## Stack

Next.js 16 (App Router) · TypeScript · Drizzle ORM · PostgreSQL (Neon) · Railway · Cloudbeds REST API · Stripe Connect.
