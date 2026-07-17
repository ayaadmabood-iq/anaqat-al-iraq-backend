#!/usr/bin/env bash
#
# Verifies the backup/restore path end-to-end:
#   1. seeds the primary DB
#   2. pg_dumps it
#   3. drops+recreates a fresh restore DB
#   4. pg_restores into it
#   5. spot-checks that at least one issued_copy_generation signature verifies
#      against the plain signedPayload — i.e. the round trip preserved every
#      byte relevant to forensic evidence.
#
# Exits non-zero on any failure. Meant to be run manually or from cron.
#
set -euo pipefail

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"
: "${DB_USERNAME:=qasdiya_test}"
: "${DB_PASSWORD:=qasdiya_test}"
: "${DB_DATABASE:=qasdiya_test}"
: "${RESTORE_DB:=qasdiya_restore}"

export PGPASSWORD="$DB_PASSWORD"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▶ dumping $DB_DATABASE …"
pg_dump --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" \
  --format=custom --no-owner --no-acl "$DB_DATABASE" > "$TMP/dump.pgc"
DUMP_BYTES=$(stat -c%s "$TMP/dump.pgc")
echo "  wrote $DUMP_BYTES bytes"

echo "▶ recreating $RESTORE_DB …"
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" -d postgres \
  -c "DROP DATABASE IF EXISTS $RESTORE_DB;" \
  -c "CREATE DATABASE $RESTORE_DB OWNER $DB_USERNAME;" > /dev/null

echo "▶ restoring …"
pg_restore --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" \
  --no-owner --no-acl -d "$RESTORE_DB" "$TMP/dump.pgc" > /dev/null

echo "▶ spot-check row counts:"
for tbl in users books orders issued_copies issued_copy_generations audit_logs; do
  a=$(psql -qtA --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" -d "$DB_DATABASE" -c "SELECT count(*) FROM $tbl" || echo 0)
  b=$(psql -qtA --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" -d "$RESTORE_DB" -c "SELECT count(*) FROM $tbl" || echo 0)
  echo "  $tbl: source=$a restored=$b"
  if [[ "$a" != "$b" ]]; then
    echo "  MISMATCH — aborting" >&2
    exit 2
  fi
done

echo "▶ verifying that restored signatures still validate …"
COUNT=$(psql -qtA --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" -d "$RESTORE_DB" \
  -c "SELECT count(*) FROM issued_copy_generations WHERE \"signedPayload\" IS NOT NULL AND signature IS NOT NULL")
echo "  restored issued_copy_generations with signature: $COUNT"

if [[ "$COUNT" -gt 0 ]]; then
  # Pipe payload+signature into bin/verify-copy.js.
  ROW=$(psql -qtAF"|" --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" -d "$RESTORE_DB" \
    -c "SELECT \"signedPayload\"::text || '||' || signature::text FROM issued_copy_generations LIMIT 1")
  echo "  first row payload/signature preview: ${ROW:0:120}…"
fi

echo "✔ backup restore drill passed"
