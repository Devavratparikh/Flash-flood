import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";

import authRouter from "./routes/auth.js";
import overviewRouter from "./routes/overview.js";
import districtsRouter from "./routes/districts.js";
import areasRouter from "./routes/areas.js";
import reportsRouter from "./routes/reports.js";
import broadcastsRouter from "./routes/broadcasts.js";
import historyRouter from "./routes/history.js";
import insightsRouter from "./routes/insights.js";
import meRouter from "./routes/me.js";

export const app = express();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, true); // pilot: permissive; tighten for production
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(config.uploadsDir));

// Tiny request logger
app.use((req, _res, next) => {
  const t = Date.now();
  req.on("close", () => {
    if (req.path !== "/api/health") {
      console.log(`${req.method} ${req.originalUrl} (${Date.now() - t}ms)`);
    }
  });
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/districts", districtsRouter);
app.use("/api/areas", areasRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/broadcasts", broadcastsRouter);
app.use("/api/history", historyRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/me", meRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});
