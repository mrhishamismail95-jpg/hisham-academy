// Minimal migration runner: applies db/migrations/*.sql in filename order,
// once each, inside a transaction. Usage: DATABASE_URL=... bun run migrate
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.MIGRATIONS_DIR || path.resolve(here, '../../../db/migrations');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) { console.log(`skip   ${file}`); continue; }
    const sqlText = await readFile(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`apply  ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`FAILED ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(`done (${applied} applied)`);
} finally {
  client.release();
  await pool.end();
}
