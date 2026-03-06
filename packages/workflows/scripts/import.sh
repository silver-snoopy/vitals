#!/usr/bin/env bash
set -euo pipefail

N8N_URL="${N8N_URL:?Set N8N_URL environment variable}"
N8N_API_KEY="${N8N_API_KEY:?Set N8N_API_KEY environment variable}"

DEFINITIONS_DIR="$(dirname "$0")/../definitions"

for file in "$DEFINITIONS_DIR"/*.json; do
  [ -f "$file" ] || continue
  echo "Importing $(basename "$file")..."
  curl -s -X POST "$N8N_URL/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -d @"$file"
  echo ""
done

echo "Import complete."
