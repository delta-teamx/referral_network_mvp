# Architecture

This document is the bird's-eye view. For code-level details see:

- `apps/api/src/domains/README.md` — domain map + conventions
- `packages/shared/src/constants/permissions.ts` — RBAC permission registry
- `packages/shared/src/constants/events.ts` — typed event catalogue
- `apps/api/prisma/schema.prisma` — data model

## Product in one paragraph

Local service businesses list themselves. Consumers find them not by
keyword search, but by **life event** (buying a house, getting married,
starting a business, …). Businesses form durable B2B networks through
connections, invitations, and referrals — the "network" part of the
product. Revenue comes from subscription tiers that gate lead volume,
photo count, sponsored placement, and group limits.

## Four domains, one process

```
┌────────────────────────────────────────────────────────────────┐
│                         apps/web (Next.js)                     │
│   consumer UI · business dashboard · admin UI · connect flow   │
└────────────────────────────────┬───────────────────────────────┘
                                 │ HTTPS JSON
┌────────────────────────────────▼───────────────────────────────┐
│                       apps/api (Express)                       │
│ ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ │
│ │  core   │ │ directory │ │ network │ │ matching │ │  search │ │
│ │ auth    │ │ listings  │ │ B2B     │ │ life-evt │ │ pg_trgm │ │
│ │ rbac    │ │ reviews   │ │ connect │ │ ranking  │ │ (→ ES)  │ │
│ │ events  │ │ categories│ │ groups  │ │ distrib. │ │         │ │
│ │ onbrd.  │ │           │ │ referr. │ │          │ │         │ │
│ └────┬────┘ └─────┬─────┘ └────┬────┘ └────┬─────┘ └────┬────┘ │
│      │            │             │           │            │     │
│      └────────────┴──────┬──────┴───────────┴────────────┘     │
│                      Event Bus                                 │
│              (in-memory → BullMQ in Branch 4)                  │
└────────────────────────────────┬───────────────────────────────┘
                                 │
   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ PostgreSQL │  │   Redis    │  │Elasticsearch│  │   Stripe   │
   │  + PostGIS │  │ BullMQ+cache│  │ (opt, B3+) │  │  (Branch 5)│
   └────────────┘  └────────────┘  └────────────┘  └────────────┘
```

One Express process, one Prisma client, one Node event loop. Domains are
folders, not services — the "microservices tax" would be too steep for
MVP. If traffic demands it later, each domain's clean seams make
extraction straightforward.

## Cross-cutting concerns

### Authentication — Branch 2

JWT access token (15 min, memory) + refresh token (30 d, HTTP-only
cookie). Google + Facebook OAuth 2.0. `authenticate` middleware populates
`req.user: { id, email, role, subscriptionTier }` for every protected
route.

### Authorization — Branch 1 skeleton, Branch 2 enforced

Permission keys in `@refnet/shared/PERMISSIONS`. Role-to-permission
mapping in `ROLE_PERMISSIONS`. Route-level checks via:

```ts
router.post('/listings', authenticate, authorize(PERMISSIONS.LISTING_CREATE), handler);
```

Permissions are persisted to `Permission` / `RolePermission` tables on
first boot (seeded from `ROLE_PERMISSIONS`) so ops can audit and
customise in production without a code deploy.

### Events — Branch 1 skeleton, Branch 4 distributed

Every meaningful state change publishes a typed event. Subscribers
register at boot in `src/index.ts`. Adding a new event requires
extending `DomainEventMap` in `@refnet/shared` so publishers and
subscribers stay in lockstep.

### Onboarding — Branch 2

First-session flow: capture zip + primary category + goals →
auto-suggest 3–5 business connections → welcome email with quick-win
checklist → first-login dashboard shows progress bar until key actions
taken. Backed by the `OnboardingProgress` table; progress drives the
`onboarding.step_completed` / `onboarding.completed` events.

### Search — Branch 3

`SearchService` interface in `domains/search/`. Default implementation
is Postgres with `pg_trgm` + GiST indexes — zero new infrastructure,
adequate for MVP traffic. When volume justifies it, drop in an
Elasticsearch implementation; callers never change.

### Matching & ranking — Branch 5

Life-events connector is a typed service:

```ts
matchingService.match({
  eventType: 'BUYING_HOUSE',
  zipCode: '63101',
  radiusMiles: 25,
  needs: ['mortgage_broker', 'home_inspector'],
}): Promise<MatchResult>
```

Ranking is pluggable via `RankingStrategy`. Lead distribution policy
(tier caps, round-robin, priority queue) lives in
`domains/matching/distribution/` and subscribes to `matching.completed`
events.

### Payments — Branch 6

Stripe subscriptions. `requireTier(...)` is implemented in terms of
permissions — PRO-tier features get a permission on signup that FREE
doesn't have, so feature gating and role gating use the same primitive.

### Analytics & dashboard — Branch 7

Collectors in `domains/analytics/collectors/` subscribe to the events
that matter (listing views, leads created/converted, referrals
sent/converted) and write to aggregate tables. Dashboard routes read
those aggregates — never recompute on request.

## Roles and their mental model

| Role             | In one sentence                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ |
| `CONSUMER`       | Finds businesses via life-event connector, leaves reviews, joins groups as a member. |
| `BUSINESS_OWNER` | Runs one or more listings, sends and receives referrals, participates in groups.     |
| `GROUP_LEADER`   | A business owner who also runs a networking group (`group:manage:own`).              |
| `CITY_CAPTAIN`   | Regional coordinator with moderation authority in their city.                        |
| `ADMIN`          | Platform-wide moderation and management — gets `ALL_PERMISSIONS`.                    |

A user's role is a bundle of default permissions; admins can override
per user via `RolePermission` adjustments without touching code.
