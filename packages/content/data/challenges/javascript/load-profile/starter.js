/**
 * Loads a user and their posts from the API at the same time.
 * GET /api/users/<userId> and GET /api/users/<userId>/posts both answer with JSON.
 * If either answer is not ok, throws an Error with the message "Request failed: <status> <url>".
 *
 * @param {number} userId
 * @returns {Promise<{ user: unknown, posts: unknown }>}
 */
export async function loadProfile(userId) {
  // Your code here.
}
