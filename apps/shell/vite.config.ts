import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mockApi } from './mock-api/plugin.ts';

export default defineConfig({
  // The mock API answers /api/… in `vite` and `vite preview` until the Node.js API arrives in Phase 4.
  plugins: [react(), mockApi()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
