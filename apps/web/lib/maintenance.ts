/**
 * Maintenance switch for the migration cutover.
 *
 * OFF by default — signups/logins stay live. To take login + signup offline
 * during the domain cutover, set NEXT_PUBLIC_MAINTENANCE_MODE=1 in the Netlify
 * environment and redeploy. Set it back to 0 (or remove it) when done.
 *
 * (It's a build-time flag because the site is a static export, so flipping it
 * requires a rebuild — a couple of minutes on Netlify.)
 */
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === '1';
