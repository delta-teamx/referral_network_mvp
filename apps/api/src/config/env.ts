import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod schema for all environment variables the API reads.
 *
 * Third-party credentials (Stripe, Twilio, SendGrid, AWS, OAuth providers)
 * are `.optional()` in Branch 1 so the server boots without them. Later
 * branches will require them via their own narrower schemas when a feature
 * is actually enabled.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_NAME: z.string().default('NRG'),
  // Comma-separated list of allowed frontend origins (for CORS + cookie domain).
  // Single URL works too; splitting happens in index.ts.
  FRONTEND_URL: z
    .string()
    .default('http://localhost:3000')
    .refine(
      (v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .every((s) => /^https?:\/\//.test(s)),
      { message: 'FRONTEND_URL must be one or more http(s) URLs, comma-separated' },
    ),
  API_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  // JWT — optional in Branch 1, required in Branch 2
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // OAuth — Branch 2
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  // Facebook OAuth removed — using Google only

  // Stripe — Branch 5
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional(),

  // AWS — Branch 3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),

  // Email (SendGrid) — handles notifications, OTP, and all transactional email
  EMAIL_FROM: z.string().email().default('noreply@nrg-ai.com'),
  SENDGRID_API_KEY: z.string().optional(),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Zoom (Server-to-Server OAuth)
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),

  // AI providers — optional. When ANTHROPIC_API_KEY is set, LLM-based scoring
  // is enabled; otherwise the rules engine is the only path.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Admin bootstrap — comma-separated emails that get ADMIN role on seed.
  // Passwords are set via ADMIN_PASSWORD (shared for initial login; admins
  // should change theirs immediately after first sign-in).
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('\u274C Invalid environment variables:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
