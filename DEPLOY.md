# Deploy to production

Three services to wire up. Total time: ~20 minutes. Total cost: ~$5/mo + domain.

## Architecture

```
nrg-ai.com               → Vercel (Next.js frontend)
api.nrg-ai.com           → Railway (Express API)
supabase.co                  → Supabase (Postgres + Storage + Auth)
```

## 1. Database — Supabase (free)

1. https://supabase.com → New project → pick a region close to your users
2. Settings → Database → copy the **Connection string** (Transaction mode, pooled). It looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. Save it — you'll paste this as `DATABASE_URL` in Railway.

## 2. Backend — Railway (~$5/mo)

1. https://railway.com → **New Project → Deploy from GitHub** → pick `delta-teamx/NRG_AI_dev`
2. Railway detects the monorepo. Set **Root Directory** to `/` (default).
3. In **Settings → Environment**, paste these vars (copy-paste as-is, fill in `[FILL-IN]`):

```bash
# ---- Core ----
NODE_ENV=production
PORT=3001
APP_NAME=NRG

# ---- Database ----
DATABASE_URL=[paste Supabase connection string]

# ---- JWT (generate with: openssl rand -hex 32) ----
JWT_ACCESS_SECRET=[64-char hex string]
JWT_REFRESH_SECRET=[64-char hex string]
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ---- CORS (comma-separated) ----
FRONTEND_URL=https://nrg-ai.com,https://www.nrg-ai.com
API_URL=https://api.nrg-ai.com

# ---- Email (optional; console fallback if unset) ----
SENDGRID_API_KEY=
EMAIL_FROM=noreply@nrg-ai.com

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
GOOGLE_CALLBACK_URL=https://api.nrg-ai.com/api/v1/auth/oauth/google/callback

# ---- Facebook OAuth (optional) ----
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_CALLBACK_URL=https://api.nrg-ai.com/api/v1/auth/oauth/facebook/callback

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

4. Deploy. Railway runs `prisma migrate deploy` then `pnpm start`.
5. Once healthy, hit `/api/v1/health` in the generated `*.up.railway.app` URL — should return `{success:true}`.
6. **Settings → Networking → Custom Domain** → add `api.nrg-ai.com` and follow the CNAME instructions at your registrar.

## 3. Frontend — Vercel (free)

1. https://vercel.com → **Add New → Project** → pick `delta-teamx/NRG_AI_dev`
2. Vercel reads `vercel.json` automatically. Confirm:
   - Framework: **Next.js**
   - Root Directory: `apps/web`
   - Build command: `cd ../.. && corepack enable && pnpm install --no-frozen-lockfile && pnpm --filter @refnet/web build`
   - Output directory: `.next`
3. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL   = https://api.nrg-ai.com
   NEXT_PUBLIC_APP_NAME  = NRG
   ```
4. Deploy. Get the `*.vercel.app` URL.
5. **Project Settings → Domains** → add `nrg-ai.com` + `www.nrg-ai.com` → follow DNS steps at your registrar.
6. Vercel auto-issues SSL certs.

## 4. Seed demo data (optional, one-time)

From your local machine after the DB is live:

```bash
# Point your local .env at Supabase
DATABASE_URL=<your-supabase-url> pnpm --filter @refnet/api prisma:seed
```

This creates the admin account + demo members so you can log in immediately.

## 5. Verify end-to-end

1. Open `https://nrg-ai.com` → homepage loads
2. Log in with `admin@nrg-ai.app` / `Admin123!`
3. Dashboard loads → AI suggestions feed shows
4. `/admin/events` → create a test event (Zoom link auto-generated — demo URL unless Zoom is configured)
5. `/members?id=<any-user-id>` → click "Book a call" → pick slot → confirm → see booking in `/dashboard/bookings`

## Cost summary

| Item | Free tier | Upgrade to |
|---|---|---|
| Domain | — | $10/yr |
| Vercel frontend | $0 (100 GB bandwidth) | $20/mo Pro |
| Railway backend | $5/mo (includes bandwidth) | Scales with usage |
| Supabase | $0 (500 MB DB, 1 GB storage, 50K MAU) | $25/mo Pro |
| SSL | $0 (auto) | — |
| **Total to launch** | **~$5/mo + $10/yr domain** | — |

## When real users break things

- **Cold starts on Railway free tier** → upgrade to Railway's paid tier (no sleep).
- **Email going to console** → add `SENDGRID_API_KEY`. 100 emails/day free.
- **Fake Zoom links** → create a Server-to-Server OAuth app at marketplace.zoom.us → add `ZOOM_*` env vars.
- **Demo Stripe checkout** → add real `STRIPE_*` keys.

Every integration has a demo fallback, so you can ship today and flip each one on as you get credentials.
