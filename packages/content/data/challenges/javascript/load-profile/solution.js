/**
 * Fetches a URL and parses its JSON body. fetch only rejects when no response arrives,
 * so an HTTP error such as 404 has to be turned into an error here.
 *
 * @param {string} url
 */
async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response.json();
}

/**
 * Loads a user and their posts from the API at the same time.
 * GET /api/users/<userId> and GET /api/users/<userId>/posts both answer with JSON.
 * If either answer is not ok, throws an Error with the message "Request failed: <status> <url>".
 *
 * @param {number} userId
 * @returns {Promise<{ user: unknown, posts: unknown }>}
 */
export async function loadProfile(userId) {
  // Both requests start before either is awaited, so the wait is the slower one, not the sum.
  const [user, posts] = await Promise.all([getJson(`/api/users/${userId}`), getJson(`/api/users/${userId}/posts`)]);
  return { user, posts };
}
