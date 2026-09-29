import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;
const API_PORT = 3100;
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
  webServer: [
    {
      // The real API against PostgreSQL (start it with `pnpm db:up`), migrated first. Every test signs up its
      // own learner, so the rate limit on new accounts is raised for the run.
      command: 'node ../api/src/migrate-cli.ts && node ../api/src/server.ts',
      env: { DATABASE_URL, PORT: String(API_PORT), AUTH_ATTEMPTS: '1000' },
      url: `http://localhost:${API_PORT}/api/tracks`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The production build, with /api sent on to the API, as a reverse proxy would in production.
      command: `vite build && vite preview --port ${PORT}`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
