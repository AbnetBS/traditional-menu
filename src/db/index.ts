import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    max: Math.max(1, Number(process.env.DB_POOL_MAX || 5)),
    idleTimeoutMillis: Math.max(1000, Number(process.env.DB_POOL_IDLE_MS || 10000)),
    allowExitOnIdle: true,
  });

// Graceful error handling for connection issues
pool.on("error", (err) => {
  console.warn("PostgreSQL pool error:", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
