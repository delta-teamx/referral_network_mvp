# Ownership & Handover — ReferralNova

_Last updated: 2026-08-03_

This document confirms that **[CLIENT NAME / COMPANY]** ("the Client") is the
owner of the ReferralNova platform, its source code, and all associated
accounts and assets listed below. The developer retains no ownership over the
delivered work.

---

## Ownership summary

| # | Asset | Owner | Status |
|---|-------|-------|--------|
| 1 | **Render** — backend / API hosting | Client | Client is workspace owner |
| 2 | **Netlify** — frontend hosting | Client | Client is team owner |
| 3 | **Domain** | Client | Already owned by Client |
| 4 | **Claude (Anthropic)** | Client | Already owned by Client |
| 5 | **Stripe** — payments | Client | Already owned by Client |

---

## Details

### 1. Render (backend / API hosting)
- Hosts the API service (`refnet-api`), defined in `render.yaml`.
- Account / workspace owner: **[client account email]**.
- The Client has full owner-level access to the Render workspace and all
  services, environment variables, and logs.

### 2. Netlify (frontend hosting)
- Hosts the web frontend (static export from `apps/web`), configured in
  `netlify.toml`.
- Account / team owner: **[client account email]**.
- The Client has full owner-level access to the Netlify team, site settings,
  build configuration, and environment variables.

### 3. Domain
- Registered to and owned by the **Client**.
- DNS points the frontend at Netlify and the API at Render.

### 4. Claude (Anthropic)
- The Anthropic / Claude account is owned by the **Client**.
- Any API keys used by the platform live under the Client's account.

### 5. Stripe (payments)
- The Stripe account is owned by the **Client**.
- All payments, subscriptions, and payouts flow to the Client's Stripe account.

---

## Source code
All source code in this repository — including its full commit history — is the
property of the **Client**. It is hosted in the Client's version-control account
and may be transferred, copied, or modified by the Client at will.

---

_Prepared by [DEVELOPER NAME] for [CLIENT NAME / COMPANY]._
