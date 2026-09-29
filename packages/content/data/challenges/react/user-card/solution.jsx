import { useEffect, useState } from 'react';

/**
 * Loads one user from /api/users/<userId> and shows their name, with loading and error states.
 * @param {{ userId: number }} props
 */
export function UserCard({ userId }) {
  const [request, setRequest] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setRequest({ status: 'loading' });
    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((user) => setRequest({ status: 'success', user }))
      .catch((error) => {
        // Aborted on purpose: a newer userId (or unmounting) replaced this request.
        if (error.name !== 'AbortError') setRequest({ status: 'error' });
      });
    // The cleanup runs before the effect runs for the next userId, and when the card leaves the page.
    return () => controller.abort();
  }, [userId]);

  if (request.status === 'loading') return <p role="status">Loading…</p>;
  if (request.status === 'error') return <p role="alert">Could not load user {userId}.</p>;
  return <h2>{request.user.name}</h2>;
}
