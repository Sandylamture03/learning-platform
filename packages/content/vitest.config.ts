import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React challenges are written in JSX.
  plugins: [react()],
  test: {
    // The package's own tests, plus every Practice Lab challenge's tests run against its solution,
    // so a published challenge is known to be solvable. (A DOM challenge asks for happy-dom in its tests file.)
    include: ['test/**/*.test.ts', 'data/challenges/**/tests.{js,jsx,ts}'],
    // Some challenges start servers, hash passwords or boot PGlite (PostgreSQL in WebAssembly), which takes
    // seconds when every package tests at once, so the default 5 and 10 seconds are too tight.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
