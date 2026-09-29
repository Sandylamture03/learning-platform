import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The package's own tests, plus every Practice Lab challenge's tests run against its solution,
    // so a published challenge is known to be solvable. (A DOM challenge asks for happy-dom in its tests file.)
    include: ['test/**/*.test.ts', 'data/challenges/**/tests.js'],
  },
});
