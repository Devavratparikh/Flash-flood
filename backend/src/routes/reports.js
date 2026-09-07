import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { query } from "../db/pool.js";
import { config } from "../config.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { minutesAgo } from "../lib/time.js";
import { events } from "../lib/events.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadsDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only image uploads are allowed")),
});

const router = Router();

const SEVERITIES = ["Normal", "Rising", "Flooding"];

function serialize(r) {
  return {
    id: String(r.id),
    areaId: r.area_id,
    location: r.location,
    severity: r.severity,
    note: r.note,
    minutesAgo: minutesAgo(r.submitted_at),
    verified: r.verified,
    reporter: r.reporter,
    coords:
      r.lat != null && r.lng != null
        ? `${Number(r.lat).toFixed(4)}° N, ${Number(r.lng).toFixed(4)}° E`
        : "",
    accuracy: r.accuracy_m,
    photoUrl: r.photo_path ? `/uploads/${r.photo_path}` : null,
  };
}

// GET /api/reports?areaId=...
router.get("/", async (req, res, next) => {
  try {
    const { areaId } = req.query;
    const { rows } = areaId
      ? await query(
          "SELECT * FROM community_reports WHERE area_id = $1 ORDER BY submitted_at DESC",
          [areaId],
        )
      : await query("SELECT * FROM community_reports ORDER BY submitted_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

// POST /api/reports  — multipart form (photo optional)
router.post("/", optionalAuth, upload.single("photo"), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.areaId) return res.status(400).json({ error: "areaId is required" });
    if (!SEVERITIES.includes(b.severity)) {
      return res.status(400).json({ error: `severity must be one of ${SEVERITIES.join(", ")}` });
    }
    const { rows: area } = await query("SELECT name FROM areas WHERE id = $1", [b.areaId]);
    if (!area.length) return res.status(404).json({ error: "Area not found" });

    const reporter = req.user ? req.user.name || req.user.email : "Resident";
    const { rows } = await query(
      `INSERT INTO community_reports
         (area_id, location, severity, note, photo_path, reporter, reporter_role,
          lat, lng, accuracy_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        b.areaId,
        b.location || area[0].name,
        b.severity,
        b.note || null,
        req.file?.filename || null,
        reporter,
        req.user?.role || "resident",
        b.lat != null ? Number(b.lat) : null,
        b.lng != null ? Number(b.lng) : null,
        b.accuracy != null ? Math.round(Number(b.accuracy)) : null,
      ],
    );
    const dto = serialize(rows[0]);
    events.emit("report:new", dto);
    res.status(201).json(dto);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/:id/verify  { verified: true|false }
router.patch("/:id/verify", requireAuth, requireRole("officer", "admin"), async (req, res, next) => {
  try {
    const verified = req.body?.verified !== false;
    const { rows } = await query(
      `UPDATE community_reports
          SET verified = $2, verified_by = $3
        WHERE id = $1 RETURNING *`,
      [req.params.id, verified, verified ? req.user.name || req.user.email : null],
    );
    if (!rows.length) return res.status(404).json({ error: "Report not found" });
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
