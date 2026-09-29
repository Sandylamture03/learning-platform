import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright owns e2e/; Vitest runs the component and mock API tests.
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    // The widgets link their stylesheet from the shadow root; the tests don't need it loaded (or its load error logged).
    environmentOptions: {
      happyDOM: { settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } },
    },
  },
});
