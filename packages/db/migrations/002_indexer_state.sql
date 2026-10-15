CREATE TABLE chain_sync_state (
  chain_id BIGINT NOT NULL,
  contract_address TEXT NOT NULL,

  last_processed_block BIGINT NOT NULL,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (
    chain_id,
    contract_address
  )
);

CREATE TABLE processed_logs (
  chain_id BIGINT NOT NULL,

  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL
    CHECK (log_index >= 0),

  block_number BIGINT NOT NULL
    CHECK (block_number >= 0),

  contract_address TEXT NOT NULL,
  event_name TEXT NOT NULL,

  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (
    chain_id,
    transaction_hash,
    log_index
  )
);