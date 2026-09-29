## Authentication and authorization

Two different questions, often mixed up:

- **Authentication** (authn): *who are you?* Signing in with a password, a code, or another service such as GitHub.
- **Authorization** (authz): *what may you do?* Whether this signed-in person may read this task, or delete that project.

The status codes follow the split: **401** when the server doesn't know who you are, **403** when it does and the answer is no, as in [the HTTP lesson](lesson:http-and-rest).

## Storing passwords

Never store a password, and never store it with fast hashing such as SHA-256 either: a leaked table of fast hashes can be guessed at billions of attempts per second. Use a **password hashing function**, slow and memory-hungry on purpose, with a random **salt** per password so identical passwords get different hashes. OWASP recommends Argon2id, then scrypt, then bcrypt for older systems. Node.js has scrypt built in:

```js
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
```

To check a password, hash the attempt with the stored salt and compare with `timingSafeEqual`, which takes the same time however many characters match. Allow long passphrases (at least 64 characters), require at least 8, and skip rules like "one symbol": they make passwords harder to remember, not to guess.

## Sessions in cookies

After a successful sign-in the server has to remember who you are on the next request. The classic answer is a **session**: a long random token (32 random bytes) stored server-side with the user's id and an expiry, and sent to the browser in a cookie:

```js
res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
```

- **`httpOnly`**: page scripts can't read it, so an XSS bug can't steal it.
- **`secure`**: only sent over HTTPS.
- **`sameSite: 'lax'`**: not sent on cross-site POSTs, which blocks most CSRF.

Store only a **hash** of the token (SHA-256 is fine here: the token is random, so there is nothing to guess), so a database leak doesn't sign anyone in. Signing out deletes the session row, and the session is gone everywhere at once.

## JWTs, and when to use them

A **JSON Web Token** is a signed piece of JSON (`{ "sub": "42", "role": "admin", "exp": … }`). The server checks the signature instead of looking anything up, so any server with the key can verify it: handy between services. The trade-offs matter:

- The payload is **signed, not encrypted**: anyone holding the token can read it.
- It **can't be revoked** before it expires without keeping server-side state, which is what it was meant to avoid. Keep expiries short (minutes) and pair them with a refresh token.
- Kept in `localStorage`, any XSS bug can steal it. If a browser holds it, an `httpOnly` cookie is safer.

For a web app talking to its own API, a session cookie is simpler and easier to secure. JWTs earn their place between services, and for mobile clients.

## Roles: checking what someone may do

The simplest authorization model is **role-based access control**: each user has roles, and each action needs one of them. In Express, that is middleware in front of the route:

```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in first' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You cannot do that' });
    next();
  };
}

app.delete('/api/projects/:id', requireRole('admin'), deleteProject);
```

Roles aren't the whole story: an ordinary user may edit *their own* tasks only. Check ownership in the query itself (`WHERE id = $1 AND user_id = $2`), so no code path can forget it. Missing checks like this top the OWASP Top 10 as "Broken Access Control".

## Mistakes that cost time

- **Fast or unsalted password hashes,** or worse, reversible encryption.
- **Different errors for "no such email" and "wrong password",** which tells an attacker which emails have accounts. Say "that email and password don't match" for both.
- **No rate limit on sign-in,** so passwords can be guessed forever.
- **Tokens in `localStorage`** or in URLs, where scripts, logs and browser history see them.
- **Checking roles in the React app only.** The browser's checks are for comfort; the server's are for security.

## Say it in an interview

“Authentication is who you are, authorization is what you may do: 401 versus 403. I store passwords with a slow, salted hash (Argon2id or scrypt), compare in constant time, and rate-limit sign-in. For a web app I use a server-side session: a random token in an httpOnly, Secure, SameSite cookie, with only its hash in the database, so sign-out really ends it. JWTs suit service-to-service calls, but they're readable and hard to revoke, so I keep them short-lived. For authorization I check roles in middleware and ownership in the query itself, always on the server.”
