import { Router } from "express";
import { query } from "../db/pool.js";
import { signToken, comparePassword, hashPassword, publicUser } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });

    const { rows } = await query("SELECT * FROM users WHERE email = $1", [String(email).toLowerCase()]);
    const user = rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register  { email, password, name, role?, districtId? }
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role, districtId } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password and name are required" });
    }
    const wantedRole = ["resident", "officer", "admin"].includes(role) ? role : "resident";

    const { rows: existing } = await query("SELECT 1 FROM users WHERE email = $1", [
      String(email).toLowerCase(),
    ]);
    if (existing.length) return res.status(409).json({ error: "That email is already registered" });

    const { rows } = await query(
      `INSERT INTO users (email, name, role, district_id, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [String(email).toLowerCase(), name, wantedRole, districtId || null, await hashPassword(password)],
    );
    await query("INSERT INTO notification_preferences (user_id) VALUES ($1)", [rows[0].id]);
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
