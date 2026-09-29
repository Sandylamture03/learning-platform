import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mockApi } from './mock-api/plugin.ts';

// /api/… goes to the Node.js API (API_URL, by default `pnpm dev:api` on port 3000), so the app and the API share
// one origin and the session cookie just works. With `--mode mock` the in-memory mock answers instead: no database.
export default defineConfig(({ mode }) => {
  const api = { '/api': { target: process.env.API_URL ?? 'http://localhost:3000' } };
  return mode === 'mock'
    ? {
        plugins: [react(), mockApi()],
        server: { port: 5173, strictPort: true },
        preview: { port: 4173, strictPort: true },
      }
    : {
        plugins: [react()],
        server: { port: 5173, strictPort: true, proxy: api },
        preview: { port: 4173, strictPort: true, proxy: api },
      };
});
