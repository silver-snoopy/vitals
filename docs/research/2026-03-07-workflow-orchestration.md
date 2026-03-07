# Decision Record: Workflow Orchestration

**Date:** 2026-03-07
**Status:** Decided
**Decision:** Keep n8n

## Context

The Vitals backend needs scheduled task orchestration for:
- Daily data collection (Cronometer + Hevy, 06:00 UTC)
- Weekly AI report generation (Monday 08:00 UTC)
- Health monitoring (every 30 minutes)

## Options Evaluated

| Tool | Type | Strengths | Weaknesses |
|------|------|-----------|------------|
| **n8n** | Visual workflow builder | Visual builder, 500+ integrations, 178k GitHub stars, MCP tooling | JavaScript-heavy for complex logic |
| **Trigger.dev** | TypeScript-native | Code-first, type-safe, good DX | Smaller community, newer |
| **Inngest** | Event-driven | Elegant event model, retries built-in | Vendor lock-in risk |
| **Temporal** | Durable workflows | Enterprise-grade, replay debugging | Heavy infrastructure, overkill for personal project |
| **BullMQ** | Redis-backed queues | Simple, lightweight, Redis-based | No visual builder, manual scheduling |

## Decision: n8n

**Reasons:**
1. **Visual workflow builder** — Rapid iteration for a personal project; drag-and-drop over code for simple HTTP triggers
2. **Community and ecosystem** — 178k GitHub stars, active development, extensive documentation
3. **MCP tooling** — `czlonkowski/n8n-mcp` (node discovery, validation) and `czlonkowski/n8n-skills` (Claude Code integration) enable AI-assisted workflow design
4. **Future extensibility** — 500+ pre-built integrations for notifications (Slack, email), monitoring, and data sources without custom code
5. **Version control** — Workflow JSONs can be exported and stored in `packages/workflows/definitions/`

**Runner-up:** Trigger.dev — would choose if the project needed complex TypeScript logic in workflows or if n8n's JavaScript code nodes proved too limiting.

## Implementation

- Workflows stored as JSON in `packages/workflows/definitions/`
- Import/export via REST API scripts (`scripts/import.sh`, `scripts/export.sh`)
- Environment configs in `packages/workflows/environments/`
- Backend exposes webhook endpoints secured with `X-API-Key`
