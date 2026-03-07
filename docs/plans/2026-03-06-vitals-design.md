# Vitals — Design Document

**Date:** 2026-03-06
**Status:** Approved

## Goal

Single-user personal health data management application with AI-powered weekly analytics for workout, nutrition, and biometric data.

## Architecture

npm workspaces monorepo with 4 packages:

| Package | Tech | Deploy To |
|---------|------|-----------|
| `packages/shared` | TypeScript types/interfaces | (consumed internally) |
| `packages/backend` | Fastify + TypeScript | Railway + Railway PostgreSQL |
| `packages/frontend` | React + Vite + Tailwind + shadcn/ui | Vercel |
| `packages/workflows` | n8n workflow JSON definitions | n8n Cloud or self-hosted |

## Data Sources

1. **Cronometer** — Nutrition & biometrics via reverse-engineered scraper (legacy code from `silver-snoopy/health-analysis`)
2. **Hevy** — Workout data via REST API (legacy code)
3. **Apple Health** — Manual CSV/XML file upload + parser (new)

## AI

- **Primary:** Claude API (`@anthropic-ai/sdk`)
- **Architecture:** Provider-agnostic `AIProvider` interface — extensible for future providers without changing pipeline
- **Features:** Weekly summary reports, correlation insights, recommendations

## n8n Orchestration

- Workflow JSONs version-controlled in `packages/workflows/`
- Designed/validated using `czlonkowski/n8n-mcp` + `n8n-skills` Claude Code plugins
- Deployed via import scripts or `salacoste/mcp-n8n-workflow-builder`

## Full Plan

See [C:\Users\D\.claude\plans\zesty-popping-tarjan.md] for complete directory structure, legacy migration map, database schema, API routes, and implementation phases.
