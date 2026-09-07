/**
 * Socket.IO client. Subscribes to backend `risk:update` / `report:new` /
 * `broadcast:new` events and invalidates the matching react-query caches so
 * the dashboard updates live. Fails quietly if the backend socket is down.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";
import { qk } from "./queries";

let socket: Socket | null = null;

export function useLive() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!socket) {
      socket = io(API_URL, { transports: ["websocket", "polling"], reconnectionDelay: 2000 });
    }
    const s = socket;

    const onRisk = () => {
      qc.invalidateQueries({ queryKey: qk.overview });
      qc.invalidateQueries({ queryKey: qk.areas });
      qc.invalidateQueries({ queryKey: ["area"] });
    };
    const onReport = () => qc.invalidateQueries({ queryKey: ["reports"] });
    const onBroadcast = () => qc.invalidateQueries({ queryKey: qk.broadcasts });

    s.on("risk:update", onRisk);
    s.on("report:new", onReport);
    s.on("broadcast:new", onBroadcast);

    return () => {
      s.off("risk:update", onRisk);
      s.off("report:new", onReport);
      s.off("broadcast:new", onBroadcast);
    };
  }, [qc]);
}
