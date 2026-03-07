# Phase 1: Monorepo Scaffold — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the npm workspaces monorepo with 4 packages (shared, backend, frontend, workflows), local dev Docker setup, and verify builds work end-to-end.

**Architecture:** npm workspaces at root, each package has its own `package.json` and `tsconfig.json` extending a shared base. Backend uses Fastify + TypeScript, frontend uses React + Vite + Tailwind, shared exports types, workflows holds n8n JSON definitions.

**Tech Stack:** Node.js 20+, TypeScript 5.x, npm workspaces, Fastify, React 18, Vite, Tailwind CSS 4, Vitest, Docker Compose (PostgreSQL 16)

---

### Task 1: Root workspace configuration

**Files:**
- Modify: `package.json` (create new — root does not have one yet)
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.npmrc`

**Step 1: Create root package.json**

```json
{
  "name": "vitals",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/backend",
    "packages/frontend",
    "packages/workflows"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "dev": "npm run dev --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "clean": "npm run clean --workspaces --if-present"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Create tsconfig.base.json**

Shared TypeScript config all packages extend. Strict mode, ES2022 target, NodeNext module resolution.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  }
}
```

**Step 3: Create .env.example**

```env
# Database (Railway PostgreSQL or local Docker)
DATABASE_URL=postgresql://vitals:vitals@localhost:5432/vitals

# AI Provider
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxx

# n8n webhook security
N8N_API_KEY=change-me

# Cronometer (legacy scraper)
CRONOMETER_USERNAME=
CRONOMETER_PASSWORD=

# Hevy API
HEVY_API_KEY=

# Default user ID (single-user)
DB_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001

# Frontend (set in Vercel)
VITE_API_URL=http://localhost:3001
```

**Step 4: Create .npmrc**

```
engine-strict=true
```

**Step 5: Update .gitignore**

Append workspace-specific ignores:

```
# Dependencies
node_modules/

# Build outputs
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

**Step 6: Commit**

```bash
git add package.json tsconfig.base.json .env.example .npmrc .gitignore
git commit -m "chore: initialize npm workspaces monorepo root"
```

---

### Task 2: Shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/interfaces/ai.ts`
- Create: `packages/shared/src/interfaces/provider.ts`
- Create: `packages/shared/src/interfaces/api.ts`
- Create: `packages/shared/src/types/nutrition.ts`
- Create: `packages/shared/src/types/workout.ts`
- Create: `packages/shared/src/types/report.ts`
- Create: `packages/shared/src/types/measurement.ts`
- Create: `packages/shared/src/constants/metrics.ts`
- Create: `packages/shared/src/constants/query-keys.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@vitals/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "files": ["dist"]
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create type files**

Create `packages/shared/src/interfaces/ai.ts` — AIProvider interface:

```typescript
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  complete(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AICompletionResult>;
  name(): string;
}
```

Create `packages/shared/src/interfaces/provider.ts` — DataProvider interface:

```typescript
export interface CollectionResult {
  provider: string;
  recordCount: number;
  dateRange: { start: Date; end: Date };
  errors: string[];
}

export interface DataProvider {
  name: string;
  collect(startDate: Date, endDate: Date): Promise<CollectionResult>;
}
```

Create `packages/shared/src/interfaces/api.ts` — API shapes:

```typescript
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

export interface CollectRequest extends DateRangeParams {
  providers?: string[];
}

export interface GenerateReportRequest extends DateRangeParams {}
```

Create `packages/shared/src/types/nutrition.ts`:

```typescript
export interface NutritionRecord {
  id: string;
  userId: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  source: string;
  collectedAt: string;
}

export interface DailyNutritionSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  goalCalories?: number;
  goalProtein?: number;
  goalCarbs?: number;
  goalFat?: number;
}
```

Create `packages/shared/src/types/workout.ts`:

```typescript
export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseName: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;
  title: string;
  durationSeconds: number;
  sets: WorkoutSet[];
  source: string;
  collectedAt: string;
}

export interface ExerciseProgress {
  exerciseName: string;
  dataPoints: {
    date: string;
    maxWeight: number;
    totalVolume: number;
    totalSets: number;
  }[];
}
```

Create `packages/shared/src/types/report.ts`:

```typescript
export interface ActionItem {
  category: 'nutrition' | 'workout' | 'recovery' | 'general';
  priority: 'high' | 'medium' | 'low';
  text: string;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  insights: string;
  actionItems: ActionItem[];
  dataCoverage: {
    nutritionDays: number;
    workoutDays: number;
    biometricDays: number;
  };
  aiProvider: string;
  aiModel: string;
  createdAt: string;
}

export interface WeeklyDataBundle {
  nutrition: import('./nutrition.js').DailyNutritionSummary[];
  workouts: import('./workout.js').WorkoutSession[];
  biometrics: import('./measurement.js').BiometricReading[];
  previousReport: WeeklyReport | null;
}
```

Create `packages/shared/src/types/measurement.ts`:

```typescript
export interface BiometricReading {
  id: string;
  userId: string;
  date: string;
  metric: string;
  value: number;
  unit: string;
  source: string;
  collectedAt: string;
}

export type BiometricMetric =
  | 'weight_kg'
  | 'body_fat_pct'
  | 'resting_hr'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'sleep_hours'
  | 'steps';
```

Create `packages/shared/src/constants/metrics.ts`:

```typescript
export const METRICS = {
  WEIGHT_KG: 'weight_kg',
  BODY_FAT_PCT: 'body_fat_pct',
  RESTING_HR: 'resting_hr',
  BP_SYSTOLIC: 'blood_pressure_systolic',
  BP_DIASTOLIC: 'blood_pressure_diastolic',
  SLEEP_HOURS: 'sleep_hours',
  STEPS: 'steps',
} as const;

export const UNITS = {
  CALORIES: 'kcal',
  WEIGHT: 'kg',
  DURATION: 'seconds',
  DISTANCE: 'meters',
} as const;
```

Create `packages/shared/src/constants/query-keys.ts`:

```typescript
export const QUERY_KEYS = {
  nutrition: {
    all: ['nutrition'] as const,
    daily: (start: string, end: string) => ['nutrition', 'daily', start, end] as const,
  },
  workouts: {
    all: ['workouts'] as const,
    sessions: (start: string, end: string) => ['workouts', 'sessions', start, end] as const,
    progress: (exercise: string) => ['workouts', 'progress', exercise] as const,
  },
  reports: {
    all: ['reports'] as const,
    latest: ['reports', 'latest'] as const,
    byId: (id: string) => ['reports', id] as const,
  },
  measurements: {
    all: ['measurements'] as const,
    byMetric: (metric: string) => ['measurements', metric] as const,
  },
  dashboard: {
    weekly: (start: string, end: string) => ['dashboard', 'weekly', start, end] as const,
  },
} as const;
```

**Step 4: Create barrel export**

Create `packages/shared/src/index.ts`:

```typescript
export * from './interfaces/ai.js';
export * from './interfaces/provider.js';
export * from './interfaces/api.js';
export * from './types/nutrition.js';
export * from './types/workout.js';
export * from './types/report.js';
export * from './types/measurement.js';
export * from './constants/metrics.js';
export * from './constants/query-keys.js';
```

**Step 5: Verify build**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add @vitals/shared package with types and interfaces"
```

---

### Task 3: Backend package scaffold

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/tsconfig.json`
- Create: `packages/backend/src/index.ts`
- Create: `packages/backend/src/app.ts`
- Create: `packages/backend/src/config/env.ts`
- Create: `packages/backend/src/routes/health.ts`

**Step 1: Create packages/backend/package.json**

```json
{
  "name": "@vitals/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@vitals/shared": "*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "pg": "^8.13.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create packages/backend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 3: Create packages/backend/src/config/env.ts**

```typescript
import 'dotenv/config';

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  aiProvider: string;
  anthropicApiKey: string;
  n8nApiKey: string;
  dbDefaultUserId: string;
  nodeEnv: string;
}

export function loadEnv(): EnvConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://vitals:vitals@localhost:5432/vitals',
    aiProvider: process.env.AI_PROVIDER || 'claude',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    n8nApiKey: process.env.N8N_API_KEY || '',
    dbDefaultUserId: process.env.DB_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
```

**Step 4: Create packages/backend/src/routes/health.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
```

**Step 5: Create packages/backend/src/app.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || ''
      : true,
  });

  await app.register(healthRoutes);

  return app;
}
```

**Step 6: Create packages/backend/src/index.ts**

```typescript
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();

const app = await buildApp();

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**Step 7: Write test for health route**

Create `packages/backend/src/routes/__tests__/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildApp } from '../../app.js';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();

    await app.close();
  });
});
```

**Step 8: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run`
Expected: PASS

**Step 9: Commit**

```bash
git add packages/backend/
git commit -m "feat: add @vitals/backend package with Fastify health route"
```

---

### Task 4: Frontend package scaffold

**Files:**
- Create: `packages/frontend/` (via `npm create vite`)
- Modify: `packages/frontend/package.json` (set name to @vitals/frontend)
- Create: Tailwind CSS config
- Create: shadcn/ui init
- Create: Basic App.tsx with router stub

**Step 1: Scaffold with Vite**

```bash
cd packages && npm create vite@latest frontend -- --template react-ts
```

**Step 2: Update packages/frontend/package.json**

Set name to `@vitals/frontend`, add dependencies:

```json
{
  "name": "@vitals/frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@vitals/shared": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.62.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Configure Tailwind CSS v4**

Update `packages/frontend/src/index.css`:

```css
@import "tailwindcss";
```

Update `packages/frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 4: Create packages/frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 5: Create minimal App.tsx**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Vitals Dashboard</h1>
      <p className="mt-2 text-gray-600">Health data analytics — coming soon.</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

**Step 6: Verify dev server starts**

Run: `cd packages/frontend && npx vite --port 3000`
Expected: Server starts, renders "Vitals Dashboard" at localhost:3000

**Step 7: Commit**

```bash
git add packages/frontend/
git commit -m "feat: add @vitals/frontend package with React + Vite + Tailwind"
```

---

### Task 5: Workflows package scaffold

**Files:**
- Create: `packages/workflows/package.json`
- Create: `packages/workflows/README.md`
- Create: `packages/workflows/environments/env.development.json`
- Create: `packages/workflows/environments/env.production.json`
- Create: `packages/workflows/definitions/.gitkeep`
- Create: `packages/workflows/scripts/import.sh`
- Create: `packages/workflows/scripts/export.sh`

**Step 1: Create packages/workflows/package.json**

```json
{
  "name": "@vitals/workflows",
  "version": "0.1.0",
  "private": true,
  "description": "n8n workflow definitions for Vitals data collection and report orchestration"
}
```

**Step 2: Create packages/workflows/README.md**

```markdown
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

- `VITALS_API_URL` — Backend API URL (e.g., `https://vitals-api.up.railway.app`)
- `VITALS_API_KEY` — API key matching backend's `N8N_API_KEY`
```

**Step 3: Create environment templates**

`packages/workflows/environments/env.development.json`:

```json
{
  "VITALS_API_URL": "http://localhost:3001",
  "VITALS_API_KEY": "dev-api-key"
}
```

`packages/workflows/environments/env.production.json`:

```json
{
  "VITALS_API_URL": "https://vitals-api.up.railway.app",
  "VITALS_API_KEY": "SET_IN_N8N_CREDENTIALS"
}
```

**Step 4: Create import/export scripts**

`packages/workflows/scripts/import.sh`:

```bash
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
```

`packages/workflows/scripts/export.sh`:

```bash
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
```

**Step 5: Create definitions placeholder**

```bash
touch packages/workflows/definitions/.gitkeep
```

**Step 6: Make scripts executable**

```bash
chmod +x packages/workflows/scripts/import.sh packages/workflows/scripts/export.sh
```

**Step 7: Commit**

```bash
git add packages/workflows/
git commit -m "feat: add @vitals/workflows package with n8n scaffold"
```

---

### Task 6: Docker Compose for local development

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: vitals
      POSTGRES_PASSWORD: vitals
      POSTGRES_DB: vitals
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitals"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

**Step 2: Verify Docker Compose starts**

Run: `docker compose up -d`
Expected: PostgreSQL starts, healthy on port 5432

Run: `docker compose ps`
Expected: postgres service running and healthy

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose with PostgreSQL for local dev"
```

---

### Task 7: Install dependencies and verify full build

**Step 1: Install all workspace dependencies**

Run: `npm install` (from root)
Expected: All packages resolve, no errors

**Step 2: Build shared package**

Run: `npm run build -w packages/shared`
Expected: Compiles to `packages/shared/dist/`

**Step 3: Build backend**

Run: `npm run build -w packages/backend`
Expected: Compiles to `packages/backend/dist/`

**Step 4: Build frontend**

Run: `npm run build -w packages/frontend`
Expected: Compiles to `packages/frontend/dist/`

**Step 5: Run backend tests**

Run: `npm run test -w packages/backend`
Expected: Health route test passes

**Step 6: Verify backend dev server**

Run: `npm run dev -w packages/backend` (background)
Then: `curl http://localhost:3001/health`
Expected: `{"status":"ok","timestamp":"..."}`

**Step 7: Commit lockfile**

```bash
git add package-lock.json
git commit -m "chore: add package-lock.json after npm install"
```

---

### Task 8: Update project documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Write a concise README covering: what Vitals is, the monorepo structure, quick start (docker compose + npm install + npm run dev), and deployment targets.

**Step 2: Update CLAUDE.md**

Append project-specific context: monorepo structure, package names, key scripts, local dev setup.

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update README and CLAUDE.md with project setup"
```

---

## Summary

After completing all 8 tasks you will have:
- A working npm workspaces monorepo with 4 packages
- Shared TypeScript types for the entire app
- Backend skeleton with Fastify + health route + passing test
- Frontend skeleton with React + Vite + Tailwind + React Router + React Query
- Workflows package with n8n scaffold, import/export scripts
- Docker Compose for local PostgreSQL
- All packages building and tests passing
