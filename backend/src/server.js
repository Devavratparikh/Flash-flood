import http from "http";
import { Server as SocketServer } from "socket.io";
import { config } from "./config.js";
import { app } from "./app.js";
import { pool } from "./db/pool.js";
import { initQueue, closeQueue } from "./lib/queue.js";
import { initRealtime } from "./lib/realtime.js";

const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: { origin: config.corsOrigins.length ? config.corsOrigins : "*" },
});
initRealtime(io);

async function start() {
  // Fail fast if the database isn't reachable / migrated.
  try {
    await pool.query("SELECT 1 FROM areas LIMIT 1");
  } catch (err) {
    console.error(
      "\nDatabase not ready. Run:\n  npm run migrate\n  npm run seed\n\n" + err.message + "\n",
    );
    process.exit(1);
  }

  await initQueue();

  server.listen(config.port, () => {
    console.log(`himvaah backend on http://localhost:${config.port}`);
    console.log(`  risk engine: ${config.riskEngine}`);
  });
}

async function shutdown() {
  console.log("\nShutting down…");
  io.close();
  server.close();
  await closeQueue();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
