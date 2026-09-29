import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;
/** A database of its own, so browser runs never touch your development data. `db:migrate` creates it. */
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/learning_platform_e2e';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    // Optional: point at an existing Chromium instead of the one `playwright install` downloads.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  // The whole platform as it runs in production: the API serving the built site at /, the built app at /app/
  // and itself at /api, against PostgreSQL (start it with `pnpm db:up`), migrated first. Every test signs up its
  // own learner, so the rate limit on new accounts is raised for the run.
  webServer: {
    command:
      'pnpm --filter @lp/site build && vite build && node ../api/src/migrate-cli.ts && node ../api/src/server.ts',
    env: { DATABASE_URL, PORT: String(PORT), SERVE_WEB: '1', AUTH_ATTEMPTS: '1000' },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
