import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function loadPreferences(userId) {
  const { rows } = await query(
    "SELECT * FROM notification_preferences WHERE user_id = $1",
    [userId],
  );
  if (!rows.length) {
    await query("INSERT INTO notification_preferences (user_id) VALUES ($1)", [userId]);
    return loadPreferences(userId);
  }
  const p = rows[0];
  const { rows: followed } = await query(
    "SELECT area_id FROM user_followed_areas WHERE user_id = $1",
    [userId],
  );
  return {
    pushEnabled: p.push_enabled,
    smsEnabled: p.sms_enabled,
    quietHoursEnabled: p.quiet_hours_enabled,
    quietStart: p.quiet_start,
    quietEnd: p.quiet_end,
    followedAreaIds: followed.map((f) => f.area_id),
  };
}

// GET /api/me/preferences
router.get("/preferences", async (req, res, next) => {
  try {
    res.json(await loadPreferences(req.user.id));
  } catch (err) {
    next(err);
  }
});

// PUT /api/me/preferences
// { pushEnabled?, smsEnabled?, quietHoursEnabled?, quietStart?, quietEnd?, followedAreaIds? }
router.put("/preferences", async (req, res, next) => {
  try {
    const b = req.body || {};
    await withTransaction(async (c) => {
      await c.query(
        `UPDATE notification_preferences SET
           push_enabled        = COALESCE($2, push_enabled),
           sms_enabled         = COALESCE($3, sms_enabled),
           quiet_hours_enabled = COALESCE($4, quiet_hours_enabled),
           quiet_start         = COALESCE($5, quiet_start),
           quiet_end           = COALESCE($6, quiet_end),
           updated_at          = now()
         WHERE user_id = $1`,
        [
          req.user.id,
          typeof b.pushEnabled === "boolean" ? b.pushEnabled : null,
          typeof b.smsEnabled === "boolean" ? b.smsEnabled : null,
          typeof b.quietHoursEnabled === "boolean" ? b.quietHoursEnabled : null,
          b.quietStart ?? null,
          b.quietEnd ?? null,
        ],
      );

      if (Array.isArray(b.followedAreaIds)) {
        await c.query("DELETE FROM user_followed_areas WHERE user_id = $1", [req.user.id]);
        for (const areaId of [...new Set(b.followedAreaIds)]) {
          await c.query(
            `INSERT INTO user_followed_areas (user_id, area_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, areaId],
          );
        }
      }
    });
    res.json(await loadPreferences(req.user.id));
  } catch (err) {
    next(err);
  }
});

export default router;
