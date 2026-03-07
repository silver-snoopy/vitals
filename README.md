# Vitals

Personal health data management application with AI-powered weekly analytics for workout, nutrition, and biometric data.

## Architecture

npm workspaces monorepo with 4 packages:

| Package | Description | Deploy |
|---------|-------------|--------|
| `@vitals/shared` | TypeScript types and interfaces | — |
| `@vitals/backend` | Fastify API server | Railway |
| `@vitals/frontend` | React + Vite + Tailwind SPA | Vercel |
| `@vitals/workflows` | n8n workflow definitions | n8n |

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker

# Start local PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Build all packages
npm run build

# Run backend (port 3001)
npm run dev -w packages/backend

# Run frontend (port 3000)
npm run dev -w packages/frontend
```

## Data Sources

- **Cronometer** — Nutrition and biometrics (scraper)
- **Hevy** — Workout data (API)
- **Apple Health** — Manual CSV/XML upload

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run dev` | Start all dev servers |
| `npm run test` | Run all tests |
| `npm run clean` | Remove build artifacts |
