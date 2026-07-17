import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema, zipCodeSchema } from './common';

/**
 * Rejects links / URLs / spam markup in human-name fields. Spam bots were
 * signing up with names like "⏳ Click https://bit.ly/… ⏳" to inject links
 * into the members directory. A real name never contains a URL, "@", angle
 * brackets, or newlines.
 */
const LINK_OR_MARKUP_RE = /(https?:\/\/|www\.|bit\.ly|t\.me|\b[a-z0-9-]+\.(com|net|org|ru|io|xyz|top|link|click|info|biz)\b|[<>]|[\r\n]|@)/i;
const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(60)
    .refine((v) => !LINK_OR_MARKUP_RE.test(v), `${label} can't contain links or symbols`);

/** Shared between signup form (frontend) and /api/v1/auth/signup (backend). */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  phone: phoneSchema.optional(),
  /**
   * CONSUMER or BUSINESS_OWNER — chosen at signup. Admin / group-leader /
   * city-captain roles are only granted through admin action.
   */
  role: z.enum(['CONSUMER', 'BUSINESS_OWNER']).default('CONSUMER'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid token'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Onboarding flow (Branch 2). */
export const onboardingStartSchema = z.object({
  zip: zipCodeSchema,
  primaryCategorySlug: z.string().trim().min(1).max(60),
  goals: z
    .array(
      z.enum([
        'get_more_leads',
        'build_referral_partners',
        'find_local_services',
        'join_networking_group',
      ]),
    )
    .min(1, 'Pick at least one goal'),
});
export type OnboardingStartInput = z.infer<typeof onboardingStartSchema>;

export const onboardingStepSchema = z.object({
  step: z.string().min(1).max(60),
  data: z.record(z.unknown()).optional(),
});
export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;
