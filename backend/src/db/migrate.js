/**
 * Minimal forward-only migration runner.
 *
 *   node src/db/migrate.js          apply any pending database/migrations/*.sql
 *   node src/db/migrate.js --reset  drop every table, then re-apply all migrations
 *
 * A migration is any `*.sql` file in database/migrations/, applied in
 * filename order. Applied filenames are recorded in schema_migrations.
 */
import fs from "fs";
import path from "path";
import { pool } from "./pool.js";
import { config } from "../config.js";

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function resetSchema() {
  console.log("Resetting public schema…");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

async function run() {
  const reset = process.argv.includes("--reset");

  if (reset) await resetSchema();
  await ensureMigrationsTable();

  const { rows } = await pool.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  const files = fs
    .readdirSync(config.migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(config.migrationsDir, file), "utf8");
    console.log(`Applying ${file}…`);
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    count++;
  }

  console.log(count ? `Applied ${count} migration(s).` : "Database already up to date.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
