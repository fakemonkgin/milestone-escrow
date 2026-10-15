CREATE TABLE projects (
  id TEXT PRIMARY KEY,

  title TEXT NOT NULL,
  description TEXT NOT NULL,

  client_address TEXT NOT NULL,
  freelancer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'AWAITING_FUNDING',
        'ACTIVE',
        'COMPLETED'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE milestones (
  project_id TEXT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  milestone_index INTEGER NOT NULL
    CHECK (milestone_index >= 0),

  title TEXT NOT NULL,
  description TEXT NOT NULL,

  amount NUMERIC(78, 0) NOT NULL
    CHECK (amount > 0),

  status TEXT NOT NULL
    CHECK (
      status IN (
        'PENDING',
        'SUBMITTED',
        'PAID'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (
    project_id,
    milestone_index
  )
);