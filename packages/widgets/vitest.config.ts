import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // The widgets link their stylesheet from the shadow root; the tests don't need it loaded (or its load error logged).
    environmentOptions: {
      happyDOM: { settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } },
    },
  },
});
