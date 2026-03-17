#!/bin/bash
# Setup Claude Code plugins for this project.
# Run once on a new machine: bash scripts/setup-claude.sh

set -euo pipefail

echo "Installing Claude Code plugins for vitals..."

# Required plugins
claude plugin install superpowers

echo ""
echo "Done! Plugins installed. Claude Code will auto-enable them via .claude/settings.json."
echo ""
echo "Optional: configure machine-specific permissions in .claude/settings.local.json"
