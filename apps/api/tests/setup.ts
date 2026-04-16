// Minimal env for tests that indirectly import config/env. Pure-unit tests
// shouldn't need a real DB; we just need the env validator to pass.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV ??= 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-minimum-32-chars-padding-xxx';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-minimum-32-chars-padding-xxx';
