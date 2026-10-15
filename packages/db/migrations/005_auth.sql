CREATE TABLE auth_nonces (
  nonce TEXT PRIMARY KEY,

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW()
);

CREATE INDEX auth_nonces_expires_at_idx
ON auth_nonces (expires_at);


CREATE TABLE auth_sessions (
  session_hash TEXT PRIMARY KEY,

  address TEXT NOT NULL,

  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW()
);

CREATE INDEX auth_sessions_address_idx
ON auth_sessions (address);

CREATE INDEX auth_sessions_expires_at_idx
ON auth_sessions (expires_at);