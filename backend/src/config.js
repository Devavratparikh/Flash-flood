import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env") });

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/himvaah",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  useQueue: (process.env.USE_QUEUE ?? "true") !== "false",
  riskEngine: process.env.RISK_ENGINE || "index", // "index" | "ml-layer1"
  mlLayer1Url: process.env.ML_LAYER1_URL || "http://localhost:5001",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  uploadsDir: path.join(__dirname, "../uploads"),
  migrationsDir: path.join(__dirname, "../../database/migrations"),
};
