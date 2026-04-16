import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E tests run against the pre-built static export
 * served on port 3401 by a simple `python3 -m http.server`. This means
 * tests reflect exactly what Netlify ships, not a hot-reload dev server.
 *
 * The webServer block auto-launches the static server before the suite.
 * Skip it by exporting PW_NO_SERVER=1 if you're running the server yourself.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3401',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Allow overriding the bundled browser when running in a sandbox
        // that has chromium pre-installed at a different path.
        ...(process.env.PW_CHROMIUM_EXEC
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_EXEC } }
          : {}),
      },
    },
  ],
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command: 'python3 -m http.server 3401 --directory out',
        url: 'http://127.0.0.1:3401/',
        reuseExistingServer: !process.env.CI,
        timeout: 20_000,
      },
});
