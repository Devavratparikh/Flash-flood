import { Router } from "express";
import { query } from "../db/pool.js";

const router = Router();

function serialize(event, timeline) {
  return {
    id: event.id,
    title: event.title,
    districtId: event.district_id,
    date: typeof event.event_date === "string" ? event.event_date : event.event_date.toISOString().slice(0, 10),
    peakScore: event.peak_score,
    rainfallTotal: event.rainfall_total_mm,
    duration: event.duration,
    outcome: event.outcome,
    timeline: timeline.map((t) => ({ t: t.t, text: t.text })),
  };
}

// GET /api/history?districtId=...&from=YYYY-MM-DD
router.get("/", async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    if (req.query.districtId) {
      params.push(req.query.districtId);
      conditions.push(`district_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      conditions.push(`event_date >= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows: events } = await query(
      `SELECT * FROM history_events ${where} ORDER BY event_date DESC`,
      params,
    );
    const { rows: timeline } = await query(
      "SELECT * FROM history_timeline ORDER BY event_id, sort_order",
    );
    const byEvent = new Map();
    for (const t of timeline) {
      if (!byEvent.has(t.event_id)) byEvent.set(t.event_id, []);
      byEvent.get(t.event_id).push(t);
    }
    res.json(events.map((e) => serialize(e, byEvent.get(e.id) ?? [])));
  } catch (err) {
    next(err);
  }
});

// GET /api/history/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM history_events WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    const { rows: timeline } = await query(
      "SELECT * FROM history_timeline WHERE event_id = $1 ORDER BY sort_order",
      [req.params.id],
    );
    res.json(serialize(rows[0], timeline));
  } catch (err) {
    next(err);
  }
});

export default router;
