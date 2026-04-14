import { z } from 'zod';

/** US ZIP code (5 digits or ZIP+4). */
export const zipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, 'Must be a valid US ZIP code');

/** US 2-letter state abbreviation. */
export const stateCodeSchema = z
  .string()
  .trim()
  .length(2, 'Must be a 2-letter state code')
  .regex(/^[A-Z]{2}$/, 'State code must be uppercase letters');

/** Trimmed, lowercased, validated email. */
export const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Password policy: 8+ chars, 1 uppercase, 1 number.
 * Consumed by signup/reset flows in Branch 2.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number');

/** E.164-style phone number, with or without leading +. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Must be a valid phone number in E.164 format');

/** Latitude: -90 to 90. */
export const latitudeSchema = z.number().gte(-90).lte(90);

/** Longitude: -180 to 180. */
export const longitudeSchema = z.number().gte(-180).lte(180);

/** Standard list pagination query. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
