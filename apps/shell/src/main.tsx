// The layer order first, then the tokens, then the styles shared with the site, then the app's own.
import '@lp/styles/layers.css';
import '@lp/design-tokens/tokens.css';
import '@lp/styles/styles.css';
import './shell.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { shouldRetry } from './api.ts';
import { routes } from './routes.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('index.html needs a #root element');

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: shouldRetry } } });
// One router for the app's lifetime, made outside React as React Router asks.
const router = createBrowserRouter(routes);

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
