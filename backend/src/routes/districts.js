import { Router } from "express";
import { query } from "../db/pool.js";
import { getAreasFull } from "../db/areas-repo.js";

const router = Router();

function serializeDistrict(row, helplines) {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    basin: row.basin,
    terrain: row.terrain,
    upstreamInfra: row.upstream_infra,
    helplines: helplines.map((h) => ({ label: h.label, number: h.number })),
  };
}

// GET /api/districts
router.get("/", async (_req, res, next) => {
  try {
    const { rows: districts } = await query("SELECT * FROM districts ORDER BY name");
    const { rows: helplines } = await query(
      "SELECT * FROM helplines ORDER BY district_id, sort_order",
    );
    const byDistrict = new Map();
    for (const h of helplines) {
      if (!byDistrict.has(h.district_id)) byDistrict.set(h.district_id, []);
      byDistrict.get(h.district_id).push(h);
    }
    res.json(districts.map((d) => serializeDistrict(d, byDistrict.get(d.id) ?? [])));
  } catch (err) {
    next(err);
  }
});

// GET /api/districts/:id  — district + its areas
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM districts WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "District not found" });
    const { rows: helplines } = await query(
      "SELECT * FROM helplines WHERE district_id = $1 ORDER BY sort_order",
      [req.params.id],
    );
    const areas = (await getAreasFull()).filter((a) => a.districtId === req.params.id);
    res.json({ ...serializeDistrict(rows[0], helplines), areas });
  } catch (err) {
    next(err);
  }
});

export default router;
