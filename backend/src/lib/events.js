import { EventEmitter } from "events";

/**
 * Process-local event bus. Domain code emits here; the Socket.IO layer
 * (src/lib/realtime.js) subscribes and pushes to connected clients.
 *
 *   events.emit("risk:update", area)          one area's snapshot changed
 *   events.emit("report:new", report)         a community report was filed
 *   events.emit("broadcast:new", broadcast)   an alert was broadcast
 */
export const events = new EventEmitter();
events.setMaxListeners(50);
