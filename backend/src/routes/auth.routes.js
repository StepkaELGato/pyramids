import { Router } from "express";
import crypto from "crypto";
import { query } from "../db.js";

const router = Router();

// ===== PASSWORD HASHING (PBKDF2) =====
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(
    String(password),
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  const s = String(storedHash);

  // совместимость со старыми данными, если где-то ещё лежит обычный текст
  if (!s.startsWith("pbkdf2$")) {
    return String(password) === s;
  }

  try {
    const parts = s.split("$");
    if (parts.length !== 4) return false;

    const iterations = Number(parts[1]);
    const salt = Buffer.from(parts[2], "hex");
    const hashHex = parts[3];

    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const testHash = crypto.pbkdf2Sync(
      String(password),
      salt,
      iterations,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST
    );

    const a = Buffer.from(testHash.toString("hex"), "hex");
    const b = Buffer.from(hashHex, "hex");

    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/*
POST /api/auth/login
body: { login, password }
*/
router.post("/login", async (req, res) => {
  const { login, password } = req.body || {};

  const loginNorm = String(login || "").trim().toLowerCase();
  const passStr = String(password || "");

  if (!loginNorm || !passStr) {
    return res.status(400).json({ message: "login and password required" });
  }

  try {
    const r = await query(
      `
      SELECT id, role_id, password_hash, is_active
      FROM public.users
      WHERE login = $1
      LIMIT 1
      `,
      [loginNorm]
    );

    if (r.rowCount === 0) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const u = r.rows[0];

    if (!u.is_active) {
      return res.status(403).json({ message: "Пользователь не активен" });
    }

    const ok = verifyPassword(passStr, u.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    res.json({ userId: u.id, roleId: u.role_id });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    res.status(500).json({ message: "Login error" });
  }
});

/*
POST /api/auth/change-password
body: { userId, oldPassword, newPassword }
*/
router.post("/change-password", async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body || {};
  const uid = Number(userId);

  const oldStr = String(oldPassword || "");
  const newStr = String(newPassword || "");

  if (!uid || !oldStr || !newStr) {
    return res
      .status(400)
      .json({ message: "userId, oldPassword, newPassword required" });
  }

  if (newStr.length < 4) {
    return res.status(400).json({ message: "Новый пароль минимум 4 символа" });
  }

  try {
    const r = await query(
      `
      SELECT id, password_hash, is_active
      FROM public.users
      WHERE id = $1
      LIMIT 1
      `,
      [uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const u = r.rows[0];

    if (!u.is_active) {
      return res.status(403).json({ message: "Пользователь не активен" });
    }

    const ok = verifyPassword(oldStr, u.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Старый пароль неверный" });
    }

    const newHash = hashPassword(newStr);

    await query(
      `
      UPDATE public.users
      SET password_hash = $2
      WHERE id = $1
      `,
      [uid, newHash]
    );

    res.json({ message: "Password changed" });
  } catch (e) {
    console.error("POST /api/auth/change-password error:", e);
    res.status(500).json({ message: "Failed to change password" });
  }
});

export default router;