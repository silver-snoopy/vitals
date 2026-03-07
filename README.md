# Vitals

Personal health data management application with AI-powered weekly analytics for workout, nutrition, and biometric data.

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1. Scaffold | Monorepo, packages, Docker | Complete |
| 2. Backend Core | DB schema, collectors, ingest pipeline | Complete (49 tests) |
| 3. Backend API + AI | Query routes, Claude AI, reports, Apple Health | Planned |
| 4. Frontend | React dashboard, charts, pages | Planned |
| 5. Deploy + n8n | Railway, Vercel, n8n workflows | Planned |

## Architecture

npm workspaces monorepo with 4 packages:

| Package | Description | Tech | Deploy |
|---------|-------------|------|--------|
| `@vitals/shared` | TypeScript types and interfaces | TypeScript | — |
| `@vitals/backend` | Fastify API server | Fastify 5, pg, Vitest | Railway |
| `@vitals/frontend` | Single-page application | React, Vite, Tailwind | Vercel |
| `@vitals/workflows` | n8n workflow definitions | n8n JSON | n8n Cloud |

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Quick Start

```bash
# Prerequisites: Node.js 20+
# Optional: Docker for local PostgreSQL (or use an external instance)

# Start local PostgreSQL (if using Docker)
docker compose up -d

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env

# Build all packages (shared must build first)
npm run build

# Run backend (port 3001) — runs DB migrations on startup
npm run dev -w packages/backend

# Run frontend (port 3000)
npm run dev -w packages/frontend
```

### Seed local database (optional)

Place Cronometer and Hevy CSV exports into `data/` at the repo root (gitignored), then:

```bash
npm run seed -w @vitals/backend
```

Re-running is safe — rows are upserted (no duplicates).

## Data Sources

| Source | Type | Method |
|--------|------|--------|
| **Cronometer** | Nutrition + biometrics | GWT scraper (reverse-engineered) |
| **Hevy** | Workout data | REST API |
| **Apple Health** | Mixed health data | XML file upload (Phase 3) |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/collect` | X-API-Key | Trigger data collection |

Additional query and report endpoints coming in Phase 3.

## Environment Variables

See [.env.example](.env.example) for all required variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AI_PROVIDER` | No | AI provider (default: `claude`) |
| `ANTHROPIC_API_KEY` | For AI | Claude API key |
| `N8N_API_KEY` | For webhooks | Secures POST endpoints |
| `HEVY_API_KEY` | For Hevy | Hevy REST API key |
| `CRONOMETER_USERNAME` | For Cronometer | Cronometer login |
| `CRONOMETER_PASSWORD` | For Cronometer | Cronometer password |

## Development

```bash
# Run all tests (49 unit tests)
npm test

# Run backend tests only
npm test -w @vitals/backend

# Run integration tests (requires PostgreSQL)
npm run test:integration -w @vitals/backend

# Build all packages
npm run build

# Clean build artifacts
npm run clean
```

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System architecture, data model, API design |
| [docs/plans/](docs/plans/) | Implementation plans (versioned by phase) |
| [docs/research/](docs/research/) | Decision records and evaluations |
| [CLAUDE.md](CLAUDE.md) | AI assistant conventions and project patterns |
