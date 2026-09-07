/**
 * Socket.IO realtime layer.
 *
 * Domain code emits on the local `events` bus. In a single-process setup
 * (queue disabled / Redis down) that's enough. When the BullMQ worker runs
 * recomputes in a separate process, it publishes those events to a Redis
 * channel that the API process subscribes to and forwards to clients.
 *
 * Client events emitted:
 *   risk:update       one area's full snapshot
 *   report:new        a new community report
 *   broadcast:new     a new broadcast
 */
import IORedis from "ioredis";
import { config } from "../config.js";
import { events } from "./events.js";

const CHANNEL = "himvaah:events";
const RELAYED = ["risk:update", "report:new", "broadcast:new"];

let io = null;

/** API side: wire the local bus + Redis subscriber to Socket.IO. */
export function initRealtime(socketServer) {
  io = socketServer;

  io.on("connection", (socket) => {
    socket.emit("hello", { ok: true, at: new Date().toISOString() });
  });

  for (const name of RELAYED) {
    events.on(name, (payload) => io?.emit(name, payload));
  }

  if (config.useQueue) {
    const sub = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (t) => (t > 3 ? null : 300 * t),
    });
    sub.on("error", () => {});
    sub
      .connect()
      .then(() => sub.subscribe(CHANNEL))
      .then(() => console.log("Realtime: subscribed to Redis event channel."))
      .catch(() => console.warn("Realtime: Redis subscribe unavailable (single-process mode)."));

    sub.on("message", (channel, raw) => {
      if (channel !== CHANNEL) return;
      try {
        const { name, payload } = JSON.parse(raw);
        if (RELAYED.includes(name)) io?.emit(name, payload);
      } catch {
        /* ignore malformed */
      }
    });
  }
}

/** Worker side: publish local bus events to Redis so the API can relay them. */
export function initRealtimePublisher() {
  const pub = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (t) => (t > 3 ? null : 300 * t),
  });
  pub.on("error", () => {});
  pub.connect().catch(() => {});

  for (const name of RELAYED) {
    events.on(name, (payload) => {
      pub.publish(CHANNEL, JSON.stringify({ name, payload })).catch(() => {});
    });
  }
}
