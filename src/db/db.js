import pg from "pg";
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initDb() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS demos (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        data          JSONB NOT NULL DEFAULT '{}',
        last_modified BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id         TEXT PRIMARY KEY,
        data       BYTEA NOT NULL,
        mime_type  TEXT NOT NULL DEFAULT 'image/png',
        created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);
  } finally {
    client.release();
  }
}
