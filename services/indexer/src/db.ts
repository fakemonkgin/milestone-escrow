import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL;

const BLOCK_BATCH_SIZE = 500n;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is required"
  );
}

export const pool = new Pool({
  connectionString,
});

