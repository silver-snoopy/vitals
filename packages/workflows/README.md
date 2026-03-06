# @vitals/workflows

n8n workflow definitions for Vitals health data orchestration.

## Workflows

| File | Schedule | Description |
|------|----------|-------------|
| `daily-collection.json` | Daily 06:00 UTC | Collects data from Cronometer + Hevy |
| `weekly-report.json` | Monday 08:00 UTC | Triggers AI weekly report generation |
| `health-monitor.json` | Every 30 min | Backend health check with alerts |

## Setup

1. Set environment variables in your n8n instance (see `environments/`)
2. Import workflows: `bash scripts/import.sh`
3. Activate workflows in n8n UI

## Import/Export

```bash
# Import all workflows to n8n
bash scripts/import.sh

# Export current n8n workflows to this directory
bash scripts/export.sh
```

## Environment Variables (set in n8n)

- `VITALS_API_URL` -- Backend API URL (e.g., `https://vitals-api.up.railway.app`)
- `VITALS_API_KEY` -- API key matching backend's `N8N_API_KEY`
