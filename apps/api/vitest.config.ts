import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each test file makes its own schema in the test database, so files can run in parallel.
    globalSetup: ['test/global-setup.ts'],
    // Real PostgreSQL, real HTTP and deliberately slow password hashing: when every package tests at once (turbo,
    // CI), the CPU is shared and the default 5 seconds is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
