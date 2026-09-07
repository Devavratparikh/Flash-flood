import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { minutesAgo } from "../lib/time.js";
import { events } from "../lib/events.js";

const router = Router();

const TIERS = ["normal", "watch", "severe"];
const ROLE_LABEL = { officer: "District Officer", admin: "NDRF Admin", resident: "Resident" };

async function serialize(row) {
  const { rows: areaRows } = await query(
    `SELECT a.name FROM broadcast_areas ba JOIN areas a ON a.id = ba.area_id
      WHERE ba.broadcast_id = $1 ORDER BY a.name`,
    [row.id],
  );
  return {
    id: String(row.id),
    tier: row.tier,
    areas: areaRows.map((a) => a.name).join(", "),
    areaIds: undefined,
    message: row.message,
    messageHi: row.message_hi,
    channels: row.channels ?? [],
    reach: row.reach,
    minutesAgo: minutesAgo(row.issued_at),
    officer: row.officer,
  };
}

// GET /api/broadcasts?limit=50
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await query(
      "SELECT * FROM broadcasts ORDER BY issued_at DESC LIMIT $1",
      [limit],
    );
    res.json(await Promise.all(rows.map(serialize)));
  } catch (err) {
    next(err);
  }
});

// POST /api/broadcasts  { tier, message, messageHi?, areaIds[], channels[] }
router.post("/", requireAuth, requireRole("officer", "admin"), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!TIERS.includes(b.tier)) return res.status(400).json({ error: `tier must be one of ${TIERS.join(", ")}` });
    if (!b.message || !String(b.message).trim()) return res.status(400).json({ error: "message is required" });
    if (!Array.isArray(b.areaIds) || !b.areaIds.length) {
      return res.status(400).json({ error: "areaIds must be a non-empty array" });
    }
    const channels = Array.isArray(b.channels) && b.channels.length ? b.channels : ["Push"];

    const { rows: areaRows } = await query(
      "SELECT id, population FROM areas WHERE id = ANY($1)",
      [b.areaIds],
    );
    if (!areaRows.length) return res.status(400).json({ error: "No matching areas" });
    const reach = Math.round(areaRows.reduce((s, a) => s + a.population, 0) * 0.9);
    const officer = `${req.user.name || req.user.email} · ${ROLE_LABEL[req.user.role] || req.user.role}`;

    const created = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO broadcasts (tier, message, message_hi, channels, reach, officer, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [b.tier, String(b.message).trim(), b.messageHi || null, channels, reach, officer, req.user.id],
      );
      for (const a of areaRows) {
        await c.query(
          "INSERT INTO broadcast_areas (broadcast_id, area_id) VALUES ($1,$2)",
          [rows[0].id, a.id],
        );
      }
      return rows[0];
    });

    // Delivery is a logged stub for the pilot — no real SMS/push gateway.
    console.log(
      `[broadcast] ${b.tier.toUpperCase()} to ${areaRows.length} area(s) over ${channels.join(", ")} — reach ~${reach}`,
    );

    const dto = await serialize(created);
    events.emit("broadcast:new", dto);
    res.status(201).json(dto);
  } catch (err) {
    next(err);
  }
});

export default router;
