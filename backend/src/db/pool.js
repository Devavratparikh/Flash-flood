import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

/** Small helper so routes can `const { rows } = await query(sql, params)`. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Run a function inside a transaction, rolling back on any throw. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
