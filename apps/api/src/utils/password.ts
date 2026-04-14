import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash a plaintext password with bcryptjs (12 rounds). */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Constant-time comparison of plaintext against a stored hash. */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
