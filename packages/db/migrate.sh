#!/bin/sh

set -eu

echo "Waiting for database..."

until psql "$DATABASE_URL" \
  -c "SELECT 1" \
  >/dev/null 2>&1
do
  sleep 1
done

echo "Database is ready."


psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW()
);
SQL


for file in /migrations/*.sql
do
  version="$(
    basename "$file" .sql
  )"

  already_applied="$(
    psql "$DATABASE_URL" \
      -tAc "
        SELECT 1
        FROM schema_migrations
        WHERE version = '$version'
      "
  )"

  if [ "$already_applied" = "1" ]
  then
    echo "Skipping migration: $version"
    continue
  fi

  echo "Applying migration: $version"

  psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -v version="$version" \
    <<SQL
BEGIN;

\\i $file

INSERT INTO schema_migrations (
  version
)
VALUES (
  :'version'
);

COMMIT;
SQL

done

echo "Migrations complete."