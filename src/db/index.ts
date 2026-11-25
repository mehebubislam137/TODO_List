import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });

    // Gracefully absorb idle client disconnections from Cloud SQL Auth Proxy scale-to-zero
    // so recycled idle sockets do not flood error logs or crash the process.
    global._postgresPool.on('error', (err: Error) => {
      if (
        err?.message?.includes('Connection terminated unexpectedly') ||
        err?.message?.includes('terminating connection')
      ) {
        return;
      }
      console.warn('SQL pool idle client notice:', err.message);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
