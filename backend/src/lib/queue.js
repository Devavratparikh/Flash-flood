/**
 * BullMQ ingestion queue for risk recomputes.
 *
 * If Redis is unreachable (or USE_QUEUE=false), `enqueueRecompute` degrades
 * gracefully: it runs the recompute synchronously in-process so the app
 * still works without a Redis server.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

export const RECOMPUTE_QUEUE = "risk-recompute";

let queue = null;
let connection = null;
let queueReady = false;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : 200 * times),
    });
    connection.on("error", () => {}); // handled via queueReady flag
  }
  return connection;
}

export async function initQueue() {
  if (!config.useQueue) {
    console.log("Queue disabled (USE_QUEUE=false) — recomputes run synchronously.");
    return;
  }
  try {
    const conn = getRedisConnection();
    await conn.connect();
    await conn.ping();
    queue = new Queue(RECOMPUTE_QUEUE, { connection: conn });
    queueReady = true;
    console.log(`BullMQ queue "${RECOMPUTE_QUEUE}" connected to Redis.`);
  } catch (err) {
    queueReady = false;
    console.warn(
      `Redis unavailable (${err.message}) — recomputes will run synchronously in-process.`,
    );
  }
}

export function isQueueReady() {
  return queueReady;
}

/**
 * Queue a recompute for an area. Falls back to a synchronous recompute when
 * the queue isn't available. Returns the recompute result when run inline,
 * otherwise null.
 */
export async function enqueueRecompute(areaId, meta = {}) {
  if (queueReady && queue) {
    await queue.add(
      "recompute",
      { areaId, ...meta },
      { removeOnComplete: 200, removeOnFail: 100, attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
    return null;
  }
  const { recomputeArea } = await import("./recompute.js");
  return recomputeArea(areaId);
}

export async function closeQueue() {
  await queue?.close();
  await connection?.quit().catch(() => {});
}
