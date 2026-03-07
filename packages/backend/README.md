# @vitals/backend

Fastify API server for health data collection, storage, and AI-powered analytics.

## Architecture

```
src/
├── app.ts              Fastify factory (plugins + routes)
├── config/env.ts       Environment configuration
├── plugins/            Fastify plugins (database)
├── middleware/          Route guards (API key)
├── routes/             HTTP endpoint handlers
├── db/                 Pool, migrations, helpers, queries
└── services/
    ├── collectors/     Data providers (Cronometer, Hevy, Apple Health)
    ├── data/           Normalizers + batch ingest
    └── ai/             AI provider + report generation
```

## Scripts

```bash
npm run dev              # Start with hot reload (tsx watch)
npm run build            # Compile TypeScript
npm test                 # Run unit tests (49 tests)
npm run test:integration # Run integration tests (requires PostgreSQL)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/collect` | X-API-Key | Trigger data collection pipeline |

## Key Patterns

**Route plugin:** Each route file exports an async function registered in `app.ts`:
```typescript
export async function myRoutes(app: FastifyInstance, opts: { env: EnvConfig }) {
  app.get('/api/my-route', async (request, reply) => {
    const result = await queryFunction(app.db, opts.env.dbDefaultUserId);
    return reply.send({ data: result });
  });
}
```

**Database:** Access via `app.db` (pg.Pool). Parameterized queries only, no ORM.

**Data collection:** Providers implement `DataProvider` interface → normalize raw data → batch ingest (500 rows, ON CONFLICT upsert).

## Environment Variables

All variables defined in `EnvConfig` interface at `src/config/env.ts`. See root `.env.example`.

## Adding a New Route

1. Create `src/routes/my-route.ts` following the plugin pattern
2. Register in `src/app.ts`: `await app.register(myRoutes, { env })`
3. Add tests in `src/routes/__tests__/my-route.test.ts`

## Adding a New Data Provider

1. Create `src/services/collectors/my-provider/client.ts` and `provider.ts`
2. Provider implements `DataProvider` from `@vitals/shared`
3. Register in `src/services/collectors/register.ts`
4. Add env vars to `EnvConfig` if needed
