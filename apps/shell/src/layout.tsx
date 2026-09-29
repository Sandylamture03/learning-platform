import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router';
import { useProgress, useSignOut } from './api.ts';
import { paths } from './paths.ts';
import { PlatformProvider } from './platform.tsx';
import { APP_NAME, Title } from './ui.tsx';

/**
 * After a client-side navigation, move focus to the main content, as a full page load would, so keyboard and
 * screen reader users start reading the new page instead of staying on the link they used. Not on the first load.
 */
function useFocusMainOnNavigate() {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    main.current?.focus();
  }, [pathname]);
  return main;
}

/** Who is signed in, with a way out; or a way in, coming back to this page. */
function AccountNav() {
  const { user } = useProgress();
  const signOut = useSignOut();
  const { pathname, search } = useLocation();
  if (user === undefined) return null; // still asking
  if (!user) {
    const onAccountPage = pathname === paths.signIn() || pathname === paths.signUp();
    return (
      <li>
        <NavLink to={onAccountPage ? paths.signIn() + search : paths.signIn(pathname)}>Sign in</NavLink>
      </li>
    );
  }
  return (
    <li className="account">
      <span className="account__name">
        <span className="visually-hidden">Signed in as </span>
        {user.name}
      </span>
      <button
        type="button"
        className="button button--small button--secondary"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        Sign out
      </button>
    </li>
  );
}

/** The layout route: header, main content and footer around every page. */
export function AppLayout() {
  const main = useFocusMainOnNavigate();
  return (
    <PlatformProvider>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link className="brand" to={paths.path}>
            <span className="brand__mark" aria-hidden="true">
              LP
            </span>{' '}
            {APP_NAME}
          </Link>
          <nav aria-label="Main">
            <ul className="nav-list" role="list">
              <li>
                <NavLink to={paths.path} end>
                  Learning path
                </NavLink>
              </li>
              <li>
                <NavLink to={paths.resources}>Resources</NavLink>
              </li>
              <AccountNav />
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="site-main" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>{APP_NAME}: the 20% of HTML5, CSS3, JavaScript, TypeScript, React and Node.js that real jobs use.</p>
        </div>
      </footer>
      <ScrollRestoration />
    </PlatformProvider>
  );
}

/** Shown in place of a page that threw while rendering; the header stays, so the learner can move on. */
export function RouteError() {
  const error = useRouteError();
  return (
    <div className="container">
      <Title>Something went wrong</Title>
      <header className="page-head">
        <p className="eyebrow">Error</p>
        <h1>Something went wrong</h1>
        <p className="page-head__lead">
          This page hit a problem
          {error instanceof Error ? `: ${error.message}` : ''}. Reload to try again, or go back to your learning path.
        </p>
      </header>
      <p className="actions">
        <Link className="button" to={paths.path}>
          Go to your learning path
        </Link>
      </p>
    </div>
  );
}
