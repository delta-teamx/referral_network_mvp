# Deploy to production

Three services to wire up. Total time: ~20 minutes. Total cost: ~$0–7/mo + domain.

## Architecture

```
referralnova.com                     → Netlify (marketing site, Next.js static export)
dashboard.referralnova.com           → Netlify (the app — login/signup/dashboard)
api.referralnova.com                 → Render (Express API)
supabase.co                          → Supabase (Postgres + Storage)
resend.com                           → Resend (transactional email)
```

> **Migration note:** the legacy `virtualprosnetwork.com` / `api.virtualprosnetwork.com`
> hosts are still allow-listed in `apps/web/lib/domains.ts` and CORS so the
> cutover is zero-downtime. `apps/web/lib/api.ts` routes requests from
> `dashboard.referralnova.com` to `api.referralnova.com` at runtime, while every
> other host keeps using `NEXT_PUBLIC_API_URL`. Retire the legacy hosts once DNS
> has fully propagated.

## 1. Database — Supabase (free)

Already provisioned (project `vpn-db`). To wire a fresh one:

1. https://supabase.com → New project → pick a region close to your users
2. Settings → Database → copy the **Connection string** (Transaction mode, pooled). It looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. Save it — you'll paste this as `DATABASE_URL` in Render.

## 2. Backend — Render (free / $7/mo for no cold starts)

The repo ships a `render.yaml` Blueprint that provisions the service + env schema.

1. https://render.com → **New → Blueprint** → pick `delta-teamx/referral_network_mvp`
2. Render reads `render.yaml`. Fill in the vars it marks `sync: false` and confirm the rest:

```bash
# ---- Core ----
NODE_ENV=production
PORT=10000
APP_NAME=Referral Nova

# ---- Database ----
DATABASE_URL=[paste Supabase connection string]

# ---- JWT (generate with: openssl rand -hex 32) ----
JWT_ACCESS_SECRET=[64-char hex string]
JWT_REFRESH_SECRET=[64-char hex string]
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ---- CORS (comma-separated; MUST include the app domain) ----
FRONTEND_URL=https://dashboard.referralnova.com,https://referralnova.com,https://referral-network-usa.netlify.app,http://localhost:3000
API_URL=https://api.referralnova.com

# ---- Email (Resend preferred; SendGrid or console fallback) ----
RESEND_API_KEY=[from resend.com → API Keys]
SENDGRID_API_KEY=
EMAIL_FROM=noreply@referralnova.com

# ---- Stripe (optional; demo checkout if unset) ----
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PREMIUM_PRICE_ID=

# ---- Zoom (optional; demo URLs if unset) ----
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

# ---- AWS S3 (optional; picsum placeholders if unset) ----
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# ---- OpenAI (optional; rules-based matching if unset) ----
OPENAI_API_KEY=

# ---- Google OAuth (optional) ----
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.referralnova.com/api/v1/auth/oauth/google/callback

# ---- Facebook OAuth (optional) ----
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_CALLBACK_URL=https://api.referralnova.com/api/v1/auth/oauth/facebook/callback

# ---- SMS (optional) ----
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ---- Observability (optional) ----
SENTRY_DSN=

# ---- Feature infra (optional) ----
REDIS_URL=
ELASTICSEARCH_URL=
```

3. Deploy. Render runs `prisma migrate deploy` then `pnpm start`.
4. Once healthy, hit `/api/v1/health` on the generated `*.onrender.com` URL — should return `{success:true}`.
5. **Settings → Custom Domains** → add `api.referralnova.com` and follow the CNAME instructions at your registrar.

## 3. Frontend — Netlify (free)

Netlify reads `netlify.toml` (static export of `apps/web/out`).

1. https://netlify.com → **Add new site → Import from Git** → pick `delta-teamx/referral_network_mvp`
2. Netlify reads `netlify.toml` automatically. Confirm the build env:
   ```
   NEXT_PUBLIC_API_URL   = https://api.virtualprosnetwork.com   # runtime routing sends dashboard.referralnova.com → api.referralnova.com
   NEXT_PUBLIC_APP_NAME  = ReferralNova
   ```
   > To flip the app straight onto the new API for all hosts, set
   > `NEXT_PUBLIC_API_URL=https://api.referralnova.com` and redeploy.
3. **Maintenance switch:** to put login/signup behind the "we'll be right back"
   screen, set `NEXT_PUBLIC_MAINTENANCE_MODE=1` and redeploy. Unset (or `0`) to go live.
4. Deploy. Get the `*.netlify.app` URL.
5. **Domain settings** → add `referralnova.com`, `www.referralnova.com`, and
   `dashboard.referralnova.com` → follow DNS steps at your registrar.
6. Netlify auto-issues SSL certs.

## 4. Email — Resend

1. https://resend.com → **Domains** → add `referralnova.com` → add the DKIM/SPF
   records it shows to your DNS → wait for **Verified**.
2. **API Keys** → create one → paste as `RESEND_API_KEY` in Render.
3. Confirm `EMAIL_FROM=noreply@referralnova.com` matches the verified domain.

## 5. Seed data (optional)

Demo seeding is gated behind `SEED_DEMO=true` and off by default in production.
`cleanupDemoData()` runs on every deploy to keep demo/test rows out of prod.

## 6. Verify end-to-end

1. Open `https://referralnova.com` → marketing homepage loads (Referral Nova branding)
2. Open `https://dashboard.referralnova.com` → redirects to `/login`
3. Sign up → lands on `/onboarding` (no OTP wall); admins receive a new-signup email
4. Dashboard loads → AI suggestions feed shows
5. `/dashboard/members` → search + open a member profile (photo, industry, ICP, video) → message / Zoom
6. `/admin/events` → create a test event (Zoom link auto-generated — demo URL unless Zoom is configured)

## Cost summary

| Item | Free tier | Upgrade to |
|---|---|---|
| Domain | — | $10/yr |
| Netlify frontend | $0 (100 GB bandwidth) | $19/mo Pro |
| Render backend | $0 (spins down when idle) | $7/mo (no cold starts) |
| Supabase | $0 (500 MB DB, 1 GB storage, 50K MAU) | $25/mo Pro |
| Resend email | $0 (3K emails/mo) | $20/mo |
| SSL | $0 (auto) | — |
| **Total to launch** | **$0 + $10/yr domain** | — |

## When real users break things

- **Cold starts on Render free tier** → upgrade to the $7/mo Starter (no spin-down).
- **Email going to console** → set `RESEND_API_KEY` (and verify the domain in Resend).
- **Fake Zoom links** → create a Server-to-Server OAuth app at marketplace.zoom.us → add `ZOOM_*` env vars.
- **Demo Stripe checkout** → add real `STRIPE_*` keys.

Every integration has a demo fallback, so you can ship today and flip each one on as you get credentials.
