#!/usr/bin/env bash
set -euo pipefail

N8N_URL="${N8N_URL:?Set N8N_URL environment variable}"
N8N_API_KEY="${N8N_API_KEY:?Set N8N_API_KEY environment variable}"

DEFINITIONS_DIR="$(dirname "$0")/../definitions"

workflows=$(curl -s "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY")

echo "$workflows" | jq -c '.data[]' | while read -r workflow; do
  name=$(echo "$workflow" | jq -r '.name' | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  echo "Exporting $name.json..."
  echo "$workflow" | jq '.' > "$DEFINITIONS_DIR/$name.json"
done

echo "Export complete."
