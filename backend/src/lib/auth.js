import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: "7d" },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    role: row.role,
    districtId: row.district_id ?? null,
    language: row.language ?? "English",
  };
}
