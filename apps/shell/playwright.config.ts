import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;

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
  webServer: {
    // The production build, served with the mock API, answering at once.
    command: `vite build && vite preview --port ${PORT}`,
    env: { MOCK_API_DELAY: '0' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
