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

// ===== VALIDATION =====
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidPhone(phone) {
  if (!phone) return false;
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

function parseBirthDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;

  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }

  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dtLocal = new Date(y, m - 1, d);

  if (dtLocal > todayLocal) return null;

  return s;
}

function isAtLeast16(birthDateYYYYMMDD) {
  const [y, m, d] = birthDateYYYYMMDD.split("-").map(Number);
  const birth = new Date(y, m - 1, d);

  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const limit = new Date(
    todayLocal.getFullYear() - 16,
    todayLocal.getMonth(),
    todayLocal.getDate()
  );

  return birth <= limit;
}

/**
 * GET /api/clients/:userId
 */
router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const r = await query(
      `
      SELECT
        u.id AS user_id,
        u.role_id,
        u.login,
        u.is_active,
        u.created_at,

        c.last_name,
        c.first_name,
        c.middle_name,
        c.phone,
        c.email,
        c.birth_date
      FROM public.users u
      JOIN public.clients c ON c.id = u.client_id
      WHERE u.id = $1
        AND u.role_id = 2
      LIMIT 1
      `,
      [userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    const row = r.rows[0];
    const fullName = [row.last_name, row.first_name, row.middle_name]
      .filter(Boolean)
      .join(" ");

    res.json({
      client: {
        userId: row.user_id,
        roleId: row.role_id,
        login: row.login,
        isActive: row.is_active,
        createdAt: row.created_at,

        lastName: row.last_name,
        firstName: row.first_name,
        middleName: row.middle_name,
        fullName,
        phone: row.phone,
        email: row.email,
        birthDate: row.birth_date,
      },
    });
  } catch (e) {
    console.error("GET /api/clients/:userId error:", e);
    res.status(500).json({ message: "Failed to load client" });
  }
});

/**
 * GET /api/clients/:userId/visits
 * История посещений = брони клиента (client_id)
 */
router.get("/:userId/visits", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const r = await query(
      `
      SELECT
        b.id AS booking_id,
        b.start_time,
        b.end_time,
        EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600.0 AS hours,

        c.id AS club_id,
        c.name AS club_name,
        c.city AS club_city,

        COUNT(d.id) AS places_count,
        COALESCE(string_agg(d.code, ', ' ORDER BY d.code), '') AS places,

        b.total_price
      FROM public.bookings b
      JOIN public.clubs c ON c.id = b.club_id
      LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
      LEFT JOIN public.devices d ON d.id = bd.device_id
      WHERE b.client_id = $1
      GROUP BY b.id, c.id
      ORDER BY b.start_time DESC
      LIMIT 200
      `,
      [userId]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/clients/:userId/visits error:", e);
    res.status(500).json({ message: "Failed to load visits" });
  }
});

/**
 * POST /api/clients
 * Регистрация. Логин = email.
 * body:
 * {
 *   password,
 *   lastName,
 *   firstName,
 *   middleName,
 *   phone,
 *   email,
 *   birthDate
 * }
 */
router.post("/", async (req, res) => {
  const {
    password,
    lastName,
    firstName,
    middleName,
    phone,
    email,
    birthDate,
  } = req.body || {};

  const emailNorm = normalizeEmail(email);

  if (!isValidEmail(emailNorm)) {
    return res.status(400).json({ message: "Неверный формат email" });
  }

  const passStr = String(password || "");
  if (!passStr || passStr.length < 4) {
    return res.status(400).json({ message: "Пароль минимум 4 символа" });
  }

  const phoneStr = String(phone || "").trim();
  if (!isValidPhone(phoneStr)) {
    return res.status(400).json({ message: "Телефон должен быть 10–15 цифр (можно с +)" });
  }

  const bd = parseBirthDate(birthDate);
  if (!bd) {
    return res.status(400).json({ message: "Неверная дата рождения" });
  }

  if (!isAtLeast16(bd)) {
    return res.status(400).json({ message: "Регистрация доступна только с 16 лет" });
  }

  const lastNameStr = String(lastName || "").trim();
  const firstNameStr = String(firstName || "").trim();
  const middleNameStr = String(middleName || "").trim() || null;

  if (!lastNameStr || !firstNameStr) {
    return res.status(400).json({ message: "Введите фамилию и имя" });
  }

  try {
    await query("BEGIN");

    const ex = await query(
      `
      SELECT 1
      FROM public.users
      WHERE login = $1
      LIMIT 1
      `,
      [emailNorm]
    );

    if (ex.rowCount > 0) {
      await query("ROLLBACK");
      return res.status(409).json({ message: "Пользователь с такой почтой уже существует" });
    }

    const pwdHash = hashPassword(passStr);

    // 1) создаём пользователя
    const u = await query(
      `
      INSERT INTO public.users (role_id, login, password_hash, is_active, created_at)
      VALUES (2, $1, $2, true, now())
      RETURNING id
      `,
      [emailNorm, pwdHash]
    );

    const userId = Number(u.rows[0].id);

    // 2) создаём клиента
    await query(
      `
      INSERT INTO public.clients (
        id,
        last_name,
        first_name,
        middle_name,
        phone,
        email,
        birth_date,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, now())
      `,
      [
        userId,
        lastNameStr,
        firstNameStr,
        middleNameStr,
        phoneStr,
        emailNorm,
        bd,
      ]
    );

    // 3) проставляем связь в users
    await query(
      `
      UPDATE public.users
      SET client_id = $1
      WHERE id = $1
      `,
      [userId]
    );

    await query("COMMIT");
    res.json({ userId });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/clients error:", e);
    res.status(500).json({ message: "Create client error" });
  }
});

export default router;