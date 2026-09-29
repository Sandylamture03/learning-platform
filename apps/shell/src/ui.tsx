// Small pieces every page uses. The class names are the site's (@lp/styles), so the app looks like the site.
import type { Priority } from '@lp/contracts';
import { Link } from 'react-router';
import { paths } from './paths.ts';

export const APP_NAME = 'Learning Platform';

/** The document title. React 19 moves a <title> rendered anywhere into the <head>. */
export function Title({ children }: { children: string }) {
  return <title>{`${children} — ${APP_NAME}`}</title>;
}

export function Loading({ children }: { children: string }) {
  return (
    <p className="loading" role="status">
      {children}
    </p>
  );
}

/** A request that failed: what did not load, why, and a way to try again. */
export function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  return (
    <div className="notice notice--error" role="alert">
      <p>
        {what} could not load
        {error instanceof Error ? `: ${error.message}` : ''}.
      </p>
      <button type="button" className="button button--small" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge--${priority.toLowerCase()}`}>{priority}</span>;
}

/** Where the page sits; the last item is the page itself. */
export function Breadcrumb({ items }: { items: readonly { to: string; label: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol role="list">
        {items.map((item, i) => (
          <li key={item.to}>
            <Link to={item.to} aria-current={i === items.length - 1 ? 'page' : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function NotFound({ title = 'Page not found', message }: { title?: string; message: string }) {
  return (
    <div className="container">
      <Title>{title}</Title>
      <header className="page-head">
        <p className="eyebrow">Not found</p>
        <h1>{title}</h1>
        <p className="page-head__lead">{message}</p>
      </header>
      <p className="actions">
        <Link className="button" to={paths.path}>
          Go to your learning path
        </Link>
      </p>
    </div>
  );
}
