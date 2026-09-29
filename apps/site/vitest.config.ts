import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns e2e/; Vitest runs the unit and build tests.
    include: ['test/**/*.test.ts'],
  },
});
