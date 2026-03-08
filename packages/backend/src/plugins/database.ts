import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { initPool, closePool } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import type { EnvConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

export const databasePlugin = fp(async function (app: FastifyInstance, opts: { env: EnvConfig }) {
  const pool = initPool(opts.env.databaseUrl);

  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    app.log.info({ migrations: applied }, 'Migrations applied');
  } else {
    app.log.info('Database schema up to date');
  }

  app.decorate('db', pool);

  app.addHook('onClose', async () => {
    await closePool();
  });
});
