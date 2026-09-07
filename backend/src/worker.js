/**
 * BullMQ worker: consumes risk-recompute jobs and updates each area's
 * snapshot / risk_scores / drivers / forecast.
 *
 *   node src/worker.js
 *
 * Run this alongside the API (`npm run dev`) when USE_QUEUE=true and Redis
 * is running. Without it, the API still works — it just recomputes inline.
 */
import { Worker } from "bullmq";
import { config } from "./config.js";
import { getRedisConnection, RECOMPUTE_QUEUE } from "./lib/queue.js";
import { recomputeArea } from "./lib/recompute.js";
import { initRealtimePublisher } from "./lib/realtime.js";

if (!config.useQueue) {
  console.error("USE_QUEUE=false — nothing for the worker to do. Exiting.");
  process.exit(0);
}

// So `risk:update` events from recompute reach connected dashboard clients
// even when the recompute happens in this separate worker process.
initRealtimePublisher();

const connection = getRedisConnection();
await connection.connect();

const worker = new Worker(
  RECOMPUTE_QUEUE,
  async (job) => {
    const { areaId } = job.data;
    const result = await recomputeArea(areaId);
    return { areaId, score: result.score, tier: result.tier ?? undefined };
  },
  { connection, concurrency: 4 },
);

worker.on("completed", (job, ret) => {
  console.log(`recompute ${job.data.areaId} → score ${ret?.score}`);
});
worker.on("failed", (job, err) => {
  console.error(`recompute ${job?.data?.areaId} failed:`, err.message);
});

console.log(`Worker listening on "${RECOMPUTE_QUEUE}" (concurrency 4).`);

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
