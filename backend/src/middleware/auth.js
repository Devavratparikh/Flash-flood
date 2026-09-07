import { verifyToken } from "../lib/auth.js";

function readToken(req) {
  const header = req.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/** Attaches req.user if a valid token is present; never rejects. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (payload) req.user = { id: Number(payload.sub), role: payload.role, email: payload.email, name: payload.name };
  next();
}

/** Rejects with 401 unless a valid token is present. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: "Authentication required" });
  req.user = { id: Number(payload.sub), role: payload.role, email: payload.email, name: payload.name };
  next();
}

/** Rejects with 403 unless the authenticated user has one of the given roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}
