import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each test file makes its own schema in the test database, so files can run in parallel.
    globalSetup: ['test/global-setup.ts'],
  },
});
