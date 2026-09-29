-- Accounts and their sessions, each learner's finished topics, and the site's waitlist.
-- Migrations run in order, once each, inside a transaction (src/migrate.ts). Never edit one that has shipped:
-- add a new file instead.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored lowercased, so one address has one account however it is typed.
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text NOT NULL,
  -- scrypt$N$r$p$salt$hash (src/passwords.ts). Never the password itself.
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A signed-in browser. The cookie holds a random token; only its SHA-256 hash is stored, so a leaked table
-- cannot be used to sign in.
CREATE TABLE sessions (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- One row per finished topic. Finishing it again replaces the row, and moves it to the end of the list.
CREATE TABLE progress (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  track_id text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, topic_id)
);

-- People who asked to hear when the platform opens. Signing up again updates the row.
CREATE TABLE waitlist (
  email text PRIMARY KEY CHECK (email = lower(email)),
  name text NOT NULL,
  track text NOT NULL,
  level text NOT NULL,
  hours_per_week integer NOT NULL CHECK (hours_per_week > 0),
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
