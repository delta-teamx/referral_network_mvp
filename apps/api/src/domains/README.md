# API domains

`apps/api/src/domains/` is organised by **business domain**, not by
technical layer. Every feature lives inside exactly one domain; cross-
domain coordination happens via the `eventBus` (see
`core/events/`), never by importing another domain's service directly.

## Domain map

| Domain      | Responsibility                                                                        | Owns tables                                                                                                 | Primary consumer          |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------- |
| `core`      | Platform primitives — auth, users, RBAC, onboarding, notifications, event bus         | `User`, `OAuthAccount`, `Permission`, `RolePermission`, `OnboardingProgress`, `Notification`, `DomainEvent` | Every other domain        |
| `directory` | Content layer — listings, photos, categories, reviews                                 | `Listing`, `ListingPhoto`, `ListingTag`, `Category`, `Review`                                               | Web consumers + search    |
| `network`   | B2B interaction — business connections, invitations, referrals, groups, relationships | `BusinessConnection`, `BusinessInvitation`, `Referral`, `Group`, `GroupMember`, `GroupEvent`                | Business owners           |
| `matching`  | Decision layer — life-events connector, ranking, lead distribution                    | `ConsumerLead`, `EventCategoryMap`                                                                          | Consumers (via connector) |
| `search`    | Infrastructure — swappable `SearchService` (pg_trgm today, ES later)                  | Indexes derived from `Listing`                                                                              | `directory`, `matching`   |
| `analytics` | Aggregates — collectors subscribe to domain events and write summary rows             | `PageView` + future aggregate tables                                                                        | `dashboard` + `admin`     |
| `health`    | Liveness/readiness probes                                                             | —                                                                                                           | Ops                       |
| `admin`     | Thin management UI routes — delegates to other domains' services                      | —                                                                                                           | Admin users               |

## Conventions

Each domain follows this shape:

```
domains/<name>/
├── <name>.routes.ts      # Express Router — HTTP layer only
├── <name>.service.ts     # Business logic — the only unit-tested layer
├── <name>.events.ts      # (optional) publishers + subscribe-at-boot wiring
├── <name>.validators.ts  # (optional) Zod schemas specific to this domain
└── <name>.types.ts       # (optional) domain types distinct from Prisma types
```

**Rules**

1. A route handler does not contain business logic — it parses the
   request (via Zod), calls the service, and formats the response.
2. A service does not import another domain's service. If it needs data
   another domain owns, it either:
   - reads the Prisma model directly (for simple reads), or
   - publishes/subscribes to a domain event (for reactive flows).
3. A service does not import Express types. Services return plain data
   or throw `AppError`; routes handle the HTTP translation.
4. Route files export a typed `Router` (not just the result of
   `Router()`) to avoid TS2742 portability errors in declaration output.
5. Feature gating and role enforcement go through
   `authorize(PERMISSIONS.XXX)` — never ad-hoc `if (user.role === ...)`
   checks in business logic.

## Event-driven flows

Cross-domain side effects use the bus in `core/events/`:

```ts
// Publishing side
await eventBus.publish('business_connection.requested', {
  connectionId,
  initiatorId,
  targetId,
});

// Subscribing side (registered at bootstrap in src/index.ts)
eventBus.subscribe('business_connection.requested', async (payload) => {
  await notifications.enqueueEmail(payload.targetId, 'connection_requested', payload);
});
```

The full list of event keys + payload shapes lives in
`@refnet/shared` (`DomainEventMap`). Adding a new event requires
updating that map — TypeScript blocks any publish/subscribe call that
drifts.

Branch 1 ships the in-memory bus. Branch 4 swaps in a BullMQ-backed
implementation that persists to `DomainEvent` for audit + replay and
distributes handlers across worker processes; callers don't change.
