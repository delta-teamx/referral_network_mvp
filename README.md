# NRG

A local business referral network platform — businesses list themselves, consumers find them through **life-event** matching (buying a house, getting married, starting a business…), and businesses exchange referrals inside networking groups.

> **Status: Branch 1 — Foundation.** Monorepo scaffold + complete Prisma schema + docker-compose infrastructure. Features (auth, directory, life-events matching, payments, dashboards) land in subsequent branches per the [Roadmap](#roadmap) below.

## Stack

| Layer          | Tech                                          |
| -------------- | --------------------------------------------- |
| Web            | Next.js 14 (App Router) + React 18 + Tailwind |
| API            | Express 4 + TypeScript (strict) + Zod         |
| Database       | PostgreSQL 15 + PostGIS (via Prisma 5)        |
| Cache / queues | Redis 7 (BullMQ added in Branch 4)            |
| Search         | Elasticsearch 8 (wired in Branch 3)           |
| Monorepo       | Turborepo + pnpm workspaces                   |

## Prerequisites

- **Node 20+** (see `.nvmrc` — use `nvm use`)
- **pnpm 10+** (`corepack enable` then `corepack prepare pnpm@10 --activate`)
- **Docker** + **Docker Compose v2**

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + PostGIS, Redis, Elasticsearch)
docker compose up -d

# 3. Copy env template and adjust if needed
cp .env.example .env

# 4. Generate Prisma client + run initial migration
pnpm --filter @refnet/api prisma:generate
pnpm --filter @refnet/api prisma:migrate

# 5. Start both apps in watch mode
pnpm dev
```

Now open:

- Web: <http://localhost:3000>
- API health: <http://localhost:3001/api/v1/health>
- Prisma Studio: `pnpm --filter @refnet/api prisma:studio`

## Repository layout

```
nrg-ai/
├── apps/
│   ├── api/          # Express + Prisma backend
│   └── web/          # Next.js 14 frontend
├── packages/
│   └── shared/       # Shared TS types, Zod validators, constants
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Scripts (root)

| Script              | What it does                             |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Runs `api` + `web` in parallel via Turbo |
| `pnpm build`        | Production build for both apps           |
| `pnpm lint`         | ESLint across every workspace            |
| `pnpm type-check`   | `tsc --noEmit` across every workspace    |
| `pnpm format`       | Prettier write                           |
| `pnpm format:check` | Prettier check (used in CI)              |

Scoped Prisma commands live under `apps/api`:

```bash
pnpm --filter @refnet/api prisma:generate
pnpm --filter @refnet/api prisma:migrate
pnpm --filter @refnet/api prisma:studio
pnpm --filter @refnet/api prisma:seed   # Branch 1: no-op stub
```

## Environment variables

See `.env.example` for the full list. Third-party service credentials (Stripe, Twilio, SendGrid, AWS, OAuth providers, Google Maps) are declared but optional in Branch 1 — the API boots without them. They become required when their owning branch ships the feature that needs them.

## Roadmap

Branches are built sequentially, one PR per branch:

1. **Foundation** _(this branch)_ — monorepo, Prisma schema, infra, CI.
2. **Auth** — JWT + OAuth (Google/Facebook), email verification, password reset, login/signup UI.
3. **Directory** — listing CRUD, S3 photo upload, Elasticsearch search, reviews, favorites.
4. **Life Events Connector** — matching algorithm, connection flow, SMS + email notifications (BullMQ).
5. **Payments** — Stripe subscriptions (Pro/Premium), feature gating, billing portal.
6. **Dashboard** — business metrics, lead inbox, referral tracker, analytics charts.
7. **Admin + Deploy** — admin panel, moderation, E2E tests (Playwright), staging deployment.

## License

Proprietary — not yet licensed for public use.
