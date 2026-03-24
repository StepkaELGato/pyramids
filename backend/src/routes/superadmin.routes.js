import { Router } from "express";
import crypto from "crypto";
import { query } from "../db.js";

const router = Router();

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

function getUserIdFromReq(req) {
  return Number(req.query.userId || req.body?.userId || req.headers["x-user-id"] || 0);
}

async function assertSuperAdmin(userId) {
  if (!userId) return null;
  const r = await query(
    `
    SELECT u.id, u.role_id, u.login, u.employee_id, u.client_id, u.is_active
    FROM public.users u
    WHERE u.id = $1
      AND u.role_id = 4
      AND u.is_active = TRUE
    LIMIT 1
    `,
    [userId]
  );
  return r.rowCount ? r.rows[0] : null;
}

function parseBool(v, fallback = false) {
  if (v == null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "да";
}

function normalizeNullable(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidPhone(phone) {
  if (!phone) return false;
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

async function requireSuperAdmin(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    res.status(400).json({ message: "userId required" });
    return null;
  }
  const me = await assertSuperAdmin(userId);
  if (!me) {
    res.status(403).json({ message: "Superadmin access required" });
    return null;
  }
  return me;
}

router.get("/meta", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;

    const [roles, deviceTypes, deviceStatuses, bookingStatuses, tournamentStatuses, clubs, services] =
      await Promise.all([
        query(`SELECT id, code, name FROM public.roles ORDER BY id`),
        query(`SELECT id, code, name FROM public.device_types ORDER BY id`),
        query(`SELECT id, code, name FROM public.device_statuses ORDER BY id`),
        query(`SELECT id, code, name FROM public.booking_statuses ORDER BY id`),
        query(`SELECT id, code, name FROM public.tournament_statuses ORDER BY id`),
        query(`SELECT id, name, city, address FROM public.clubs ORDER BY city, name, id`),
        query(`SELECT id, name, description FROM public.services ORDER BY name, id`),
      ]);

    res.json({
      roles: roles.rows,
      deviceTypes: deviceTypes.rows,
      deviceStatuses: deviceStatuses.rows,
      bookingStatuses: bookingStatuses.rows,
      tournamentStatuses: tournamentStatuses.rows,
      clubs: clubs.rows,
      services: services.rows,
      categories: [
        { key: "devices", name: "Девайсы" },
        { key: "clubs", name: "Клубы" },
        { key: "clients", name: "Клиенты" },
        { key: "users", name: "Пользователи" },
        { key: "employees", name: "Работники" },
        { key: "services", name: "Услуги" },
        { key: "prices", name: "Цены" },
        { key: "bookings", name: "Бронирования" },
        { key: "tournaments", name: "Турниры" },
        { key: "teams", name: "Команды" },
      ],
    });
  } catch (e) {
    console.error("GET /api/superadmin/meta error:", e);
    res.status(500).json({ message: "Failed to load superadmin meta" });
  }
});

router.get("/items/:category", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;

    const category = String(req.params.category || "");
    const q = `%${String(req.query.search || "").trim().toLowerCase()}%`;

    let result;

    switch (category) {
      case "clubs":
        result = await query(
          `
          SELECT id, name, city, address, phone, work_hours, latitude, longitude, created_at
          FROM public.clubs
          WHERE ($1 = '%%' OR lower(coalesce(name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(address, '')) LIKE $1)
          ORDER BY city, name, id
          `,
          [q]
        );
        break;

      case "services":
        result = await query(
          `
          SELECT id, name, description, created_at
          FROM public.services
          WHERE ($1 = '%%' OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) LIKE $1)
          ORDER BY name, id
          `,
          [q]
        );
        break;

      case "employees":
        result = await query(
          `
          SELECT
            e.id,
            e.club_id,
            c.name AS club_name,
            e.last_name,
            e.first_name,
            e.middle_name,
            e.phone,
            e.email,
            e.position,
            e.created_at
          FROM public.employees e
          LEFT JOIN public.clubs c ON c.id = e.club_id
          WHERE ($1 = '%%' OR lower(coalesce(e.last_name,'') || ' ' || coalesce(e.first_name,'') || ' ' || coalesce(e.middle_name,'') || ' ' || coalesce(e.email,'') || ' ' || coalesce(e.position,'')) LIKE $1)
          ORDER BY e.last_name, e.first_name, e.id
          `,
          [q]
        );
        break;

      case "users":
        result = await query(
          `
          SELECT
            u.id,
            u.role_id,
            r.code AS role_code,
            r.name AS role_name,
            u.login,
            u.is_active,
            u.client_id,
            u.employee_id,
            u.created_at,
            trim(coalesce(cl.last_name,'') || ' ' || coalesce(cl.first_name,'') || ' ' || coalesce(cl.middle_name,'')) AS client_full_name,
            trim(coalesce(e.last_name,'') || ' ' || coalesce(e.first_name,'') || ' ' || coalesce(e.middle_name,'')) AS employee_full_name
          FROM public.users u
          JOIN public.roles r ON r.id = u.role_id
          LEFT JOIN public.clients cl ON cl.id = u.client_id
          LEFT JOIN public.employees e ON e.id = u.employee_id
          WHERE ($1 = '%%' OR lower(coalesce(u.login,'') || ' ' || coalesce(r.code,'') || ' ' || coalesce(r.name,'') || ' ' || coalesce(cl.last_name,'') || ' ' || coalesce(cl.first_name,'') || ' ' || coalesce(e.last_name,'') || ' ' || coalesce(e.first_name,'')) LIKE $1)
          ORDER BY u.id
          `,
          [q]
        );
        break;

      case "devices":
        result = await query(
          `
          SELECT
            d.id,
            d.club_id,
            c.name AS club_name,
            d.type_id,
            dt.code AS type_code,
            dt.name AS type_name,
            d.code,
            d.status_id,
            ds.code AS status_code,
            ds.name AS status_name,
            d.notes,
            d.created_at,
            pc.cpu,
            pc.gpu,
            pc.ram_gb,
            pc.storage_gb,
            pc.monitor_hz,
            cs.platform,
            cs.controllers,
            cs.display,
            vr.model,
            vr.play_area
          FROM public.devices d
          JOIN public.clubs c ON c.id = d.club_id
          JOIN public.device_types dt ON dt.id = d.type_id
          JOIN public.device_statuses ds ON ds.id = d.status_id
          LEFT JOIN public.device_pc_specs pc ON pc.device_id = d.id
          LEFT JOIN public.device_console_specs cs ON cs.device_id = d.id
          LEFT JOIN public.device_vr_specs vr ON vr.device_id = d.id
          WHERE ($1 = '%%' OR lower(coalesce(d.code,'') || ' ' || coalesce(c.name,'') || ' ' || coalesce(dt.name,'') || ' ' || coalesce(ds.name,'') || ' ' || coalesce(d.notes,'')) LIKE $1)
          ORDER BY c.name, d.code, d.id
          `,
          [q]
        );
        break;

      case "prices":
        result = await query(
          `
          SELECT
            sp.id,
            sp.service_id,
            s.name AS service_name,
            sp.club_id,
            c.name AS club_name,
            sp.price_per_hour,
            sp.price_fixed,
            sp.currency,
            sp.is_active,
            sp.valid_from,
            sp.valid_to,
            sp.created_at
          FROM public.service_prices sp
          JOIN public.services s ON s.id = sp.service_id
          LEFT JOIN public.clubs c ON c.id = sp.club_id
          WHERE ($1 = '%%' OR lower(coalesce(s.name,'') || ' ' || coalesce(c.name,'') || ' ' || coalesce(sp.currency,'')) LIKE $1)
          ORDER BY s.name, sp.valid_from DESC, sp.id DESC
          `,
          [q]
        );
        break;

      case "bookings":
        result = await query(
          `
          SELECT
            b.id,
            b.club_id,
            c.name AS club_name,
            b.client_id,
            b.guest_last_name,
            b.guest_first_name,
            b.guest_middle_name,
            b.guest_phone,
            b.guest_email,
            b.status_id,
            bs.name AS status_name,
            b.service_id,
            s.name AS service_name,
            b.start_time,
            b.end_time,
            b.comment,
            b.total_price,
            b.created_at,
            COALESCE(
              json_agg(
                json_build_object('id', d.id, 'code', d.code)
              ) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) AS devices
          FROM public.bookings b
          JOIN public.clubs c ON c.id = b.club_id
          LEFT JOIN public.booking_statuses bs ON bs.id = b.status_id
          LEFT JOIN public.services s ON s.id = b.service_id
          LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
          LEFT JOIN public.devices d ON d.id = bd.device_id
          WHERE ($1 = '%%' OR lower(coalesce(c.name,'') || ' ' || coalesce(s.name,'') || ' ' || coalesce(b.guest_last_name,'') || ' ' || coalesce(b.guest_first_name,'') || ' ' || coalesce(b.comment,'')) LIKE $1)
          GROUP BY b.id, c.name, bs.name, s.name
          ORDER BY b.start_time DESC, b.id DESC
          `,
          [q]
        );
        break;

      case "tournaments":
        result = await query(
          `
          SELECT
            t.id,
            t.club_id,
            c.name AS club_name,
            t.name,
            t.game,
            t.description,
            t.status_id,
            ts.name AS status_name,
            t.starts_at,
            t.ends_at,
            t.entry_fee,
            t.prize_pool,
            t.created_at,
            COALESCE((
              SELECT json_agg(json_build_object('id', tm.id, 'name', tm.name) ORDER BY tm.name)
              FROM public.tournament_teams tt
              JOIN public.teams tm ON tm.id = tt.team_id
              WHERE tt.tournament_id = t.id
            ), '[]'::json) AS teams
          FROM public.tournaments t
          LEFT JOIN public.clubs c ON c.id = t.club_id
          JOIN public.tournament_statuses ts ON ts.id = t.status_id
          WHERE ($1 = '%%' OR lower(coalesce(t.name,'') || ' ' || coalesce(t.game,'') || ' ' || coalesce(c.name,'') || ' ' || coalesce(t.description,'')) LIKE $1)
          ORDER BY t.starts_at DESC NULLS LAST, t.id DESC
          `,
          [q]
        );
        break;

      case "teams":
        result = await query(
          `
          SELECT
            t.id,
            t.name,
            t.club_id,
            c.name AS club_name,
            t.created_by,
            t.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'userId', u.id,
                  'fullName', trim(coalesce(cl.last_name,'') || ' ' || coalesce(cl.first_name,'') || ' ' || coalesce(cl.middle_name,'')),
                  'login', u.login
                )
              ) FILTER (WHERE u.id IS NOT NULL),
              '[]'::json
            ) AS members
          FROM public.teams t
          LEFT JOIN public.clubs c ON c.id = t.club_id
          LEFT JOIN public.team_members tm ON tm.team_id = t.id
          LEFT JOIN public.users u ON u.id = tm.user_id
          LEFT JOIN public.clients cl ON cl.id = u.client_id
          WHERE ($1 = '%%' OR lower(coalesce(t.name,'') || ' ' || coalesce(c.name,'')) LIKE $1)
          GROUP BY t.id, c.name
          ORDER BY t.name, t.id
          `,
          [q]
        );
        break;

      case "clients":
        result = await query(
          `
          SELECT
            c.id,
            c.last_name,
            c.first_name,
            c.middle_name,
            c.phone,
            c.email,
            c.birth_date,
            c.created_at,
            trim(coalesce(c.last_name,'') || ' ' || coalesce(c.first_name,'') || ' ' || coalesce(c.middle_name,'')) AS full_name
          FROM public.clients c
          WHERE (
            $1 = '%%'
            OR lower(
              coalesce(c.last_name,'') || ' ' ||
              coalesce(c.first_name,'') || ' ' ||
              coalesce(c.middle_name,'') || ' ' ||
              coalesce(c.phone,'') || ' ' ||
              coalesce(c.email,'') || ' ' ||
              coalesce(c.id::text,'')
            ) LIKE $1
          )
          ORDER BY c.last_name, c.first_name, c.id
          `,
          [q]
        );
        break;
      
      default:
        return res.status(404).json({ message: "Unknown category" });
    }

    res.json({ items: result.rows });
  } catch (e) {
    console.error("GET /api/superadmin/items/:category error:", e);
    res.status(500).json({ message: "Failed to load items" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;

    const r = await query(
      `
      SELECT
        u.id AS user_id,
        u.login,
        u.role_id,
        e.id AS employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.email,
        e.phone,
        e.position
      FROM public.users u
      LEFT JOIN public.employees e ON e.id = u.employee_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [me.id]
    );

    res.json({ admin: r.rowCount ? r.rows[0] : me });
  } catch (e) {
    console.error("GET /api/superadmin/me error:", e);
    res.status(500).json({ message: "Failed to load superadmin profile" });
  }
});

router.post("/items/:category", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;
    const category = String(req.params.category || "");
    const body = req.body || {};

    await query("BEGIN");

    switch (category) {
      case "clubs": {
        const r = await query(
          `
          INSERT INTO public.clubs (name, city, address, phone, work_hours, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
          `,
          [
            normalizeNullable(body.name),
            normalizeNullable(body.city),
            normalizeNullable(body.address),
            normalizeNullable(body.phone),
            normalizeNullable(body.work_hours),
            numberOrNull(body.latitude),
            numberOrNull(body.longitude),
          ]
        );
        await query("COMMIT");
        return res.json({ id: Number(r.rows[0].id), message: "Клуб создан" });
      }

      case "clients": {
        const emailNorm = normalizeNullable(body.email)?.toLowerCase() || "";
        const phoneStr = String(body.phone || "").trim();
        const passStr = String(body.password || "").trim();
        const lastNameStr = String(body.last_name || "").trim();
        const firstNameStr = String(body.first_name || "").trim();
        const middleNameStr = String(body.middle_name || "").trim() || null;
        const birthDateStr = normalizeNullable(body.birth_date);

        if (!isValidEmail(emailNorm)) {
          throw new Error("Неверный формат email");
        }

        if (!passStr || passStr.length < 4) {
          throw new Error("Пароль минимум 4 символа");
        }

        if (!isValidPhone(phoneStr)) {
          throw new Error("Телефон должен быть 10–15 цифр (можно с +)");
        }

        if (!birthDateStr) {
          throw new Error("Неверная дата рождения");
        }

        if (!lastNameStr || !firstNameStr) {
          throw new Error("Введите фамилию и имя");
        }

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
          throw new Error("Пользователь с такой почтой уже существует");
        }

        const u = await query(
          `
          INSERT INTO public.users (role_id, login, password_hash, is_active, created_at)
          VALUES (2, $1, $2, true, now())
          RETURNING id
          `,
          [emailNorm, hashPassword(passStr)]
        );

        const newUserId = Number(u.rows[0].id);

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
            newUserId,
            lastNameStr,
            firstNameStr,
            middleNameStr,
            phoneStr,
            emailNorm,
            birthDateStr,
          ]
        );

        await query(
          `
          UPDATE public.users
          SET client_id = $1
          WHERE id = $1
          `,
          [newUserId]
        );

        await query("COMMIT");
        return res.json({ id: newUserId, message: "Клиент создан" });
      }

      case "services": {
        const r = await query(
          `INSERT INTO public.services (name, description) VALUES ($1, $2) RETURNING id`,
          [normalizeNullable(body.name), normalizeNullable(body.description)]
        );
        await query("COMMIT");
        return res.json({ id: Number(r.rows[0].id), message: "Услуга создана" });
      }

      case "employees": {
        const r = await query(
          `
          INSERT INTO public.employees (club_id, last_name, first_name, middle_name, phone, email, position)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
          `,
          [
            numberOrNull(body.club_id),
            normalizeNullable(body.last_name),
            normalizeNullable(body.first_name),
            normalizeNullable(body.middle_name),
            normalizeNullable(body.phone),
            normalizeNullable(body.email),
            normalizeNullable(body.position),
          ]
        );
        await query("COMMIT");
        return res.json({ id: Number(r.rows[0].id), message: "Работник создан" });
      }

      case "users": {
        const password = String(body.password || "").trim();
        if (!body.login || !body.role_id || !password) {
          throw new Error("Для пользователя нужны login, role_id и password");
        }
        const r = await query(
          `
          INSERT INTO public.users (role_id, password_hash, is_active, login, client_id, employee_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
          `,
          [
            Number(body.role_id),
            hashPassword(password),
            parseBool(body.is_active, true),
            normalizeNullable(body.login)?.toLowerCase(),
            numberOrNull(body.client_id),
            numberOrNull(body.employee_id),
          ]
        );
        await query("COMMIT");
        return res.json({ id: Number(r.rows[0].id), message: "Пользователь создан" });
      }

      case "devices": {
        const r = await query(
          `
          INSERT INTO public.devices (club_id, type_id, code, status_id, notes)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
          `,
          [
            Number(body.club_id),
            Number(body.type_id),
            normalizeNullable(body.code),
            Number(body.status_id),
            normalizeNullable(body.notes),
          ]
        );
        const deviceId = Number(r.rows[0].id);
        const typeId = Number(body.type_id);
        const typeRes = await query(`SELECT code FROM public.device_types WHERE id = $1`, [typeId]);
        const typeCode = String(typeRes.rows[0]?.code || "").toLowerCase();

        if (typeCode === "pc") {
          await query(
            `INSERT INTO public.device_pc_specs (device_id, cpu, gpu, ram_gb, storage_gb, monitor_hz) VALUES ($1,$2,$3,$4,$5,$6)`,
            [deviceId, normalizeNullable(body.cpu), normalizeNullable(body.gpu), numberOrNull(body.ram_gb), numberOrNull(body.storage_gb), numberOrNull(body.monitor_hz)]
          );
        } else if (typeCode === "console") {
          await query(
            `INSERT INTO public.device_console_specs (device_id, platform, controllers, display) VALUES ($1,$2,$3,$4)`,
            [deviceId, normalizeNullable(body.platform), numberOrNull(body.controllers), normalizeNullable(body.display)]
          );
        } else if (typeCode === "vr") {
          await query(
            `INSERT INTO public.device_vr_specs (device_id, model, play_area) VALUES ($1,$2,$3)`,
            [deviceId, normalizeNullable(body.model), normalizeNullable(body.play_area)]
          );
        }

        await query("COMMIT");
        return res.json({ id: deviceId, message: "Устройство создано" });
      }
            case "prices": {
        const r = await query(
          `
          INSERT INTO public.service_prices (
            service_id, club_id, price_per_hour, price_fixed, currency, is_active, valid_from, valid_to
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id
          `,
          [
            Number(body.service_id),
            numberOrNull(body.club_id),
            numberOrNull(body.price_per_hour),
            numberOrNull(body.price_fixed),
            normalizeNullable(body.currency) || "RUB",
            parseBool(body.is_active, true),
            normalizeNullable(body.valid_from) || new Date().toISOString().slice(0, 10),
            normalizeNullable(body.valid_to),
          ]
        );
        await query("COMMIT");
        return res.json({ id: Number(r.rows[0].id), message: "Цена создана" });
      }

      case "bookings": {
        const r = await query(
          `
          INSERT INTO public.bookings (
            club_id, client_id, guest_last_name, guest_first_name, guest_middle_name,
            guest_phone, guest_email, status_id, service_id, start_time, end_time, comment, total_price
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING id
          `,
          [
            Number(body.club_id),
            numberOrNull(body.client_id),
            normalizeNullable(body.guest_last_name),
            normalizeNullable(body.guest_first_name),
            normalizeNullable(body.guest_middle_name),
            normalizeNullable(body.guest_phone),
            normalizeNullable(body.guest_email),
            Number(body.status_id),
            numberOrNull(body.service_id),
            normalizeNullable(body.start_time),
            normalizeNullable(body.end_time),
            normalizeNullable(body.comment),
            numberOrNull(body.total_price),
          ]
        );
        const bookingId = Number(r.rows[0].id);
        const deviceId = numberOrNull(body.device_id);
        if (deviceId) {
          await query(
            `INSERT INTO public.booking_devices (booking_id, device_id, start_time, end_time) VALUES ($1,$2,$3,$4)`,
            [bookingId, deviceId, normalizeNullable(body.start_time), normalizeNullable(body.end_time)]
          );
        }
        await query("COMMIT");
        return res.json({ id: bookingId, message: "Бронирование создано" });
      }

      case "tournaments": {
        const r = await query(
          `
          INSERT INTO public.tournaments (club_id, name, game, description, status_id, starts_at, ends_at, entry_fee, prize_pool)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id
          `,
          [
            numberOrNull(body.club_id),
            normalizeNullable(body.name),
            normalizeNullable(body.game),
            normalizeNullable(body.description),
            Number(body.status_id),
            normalizeNullable(body.starts_at),
            normalizeNullable(body.ends_at),
            numberOrNull(body.entry_fee) ?? 0,
            numberOrNull(body.prize_pool) ?? 0,
          ]
        );
        const tournamentId = Number(r.rows[0].id);
        const teamIds = Array.isArray(body.team_ids) ? body.team_ids.map(Number).filter(Boolean) : [];
        for (const teamId of teamIds) {
          await query(`INSERT INTO public.tournament_teams (tournament_id, team_id) VALUES ($1,$2)`, [tournamentId, teamId]);
        }
        await query("COMMIT");
        return res.json({ id: tournamentId, message: "Турнир создан" });
      }

      case "teams": {
        const r = await query(
          `INSERT INTO public.teams (name, created_by, club_id) VALUES ($1,$2,$3) RETURNING id`,
          [normalizeNullable(body.name), me.id, numberOrNull(body.club_id)]
        );
        const teamId = Number(r.rows[0].id);
        const memberIds = Array.isArray(body.member_ids) ? body.member_ids.map(Number).filter(Boolean) : [];
        for (const memberId of memberIds) {
          await query(`INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1,$2,NULL)`, [teamId, memberId]);
        }
        await query("COMMIT");
        return res.json({ id: teamId, message: "Команда создана" });
      }

      default:
        throw new Error("Unknown category");
    }
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/superadmin/items/:category error:", e);
    res.status(500).json({ message: e?.message || "Failed to create item" });
  }
});

router.get("/booking-availability", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;

    const clubId = Number(req.query.clubId);
    const start = req.query.start;
    const end = req.query.end;

    if (!clubId || !start || !end) {
      return res.status(400).json({ message: "clubId, start, end required" });
    }

    const r = await query(
      `
      SELECT DISTINCT x.device_id
      FROM (
        SELECT bd.device_id
        FROM public.booking_devices bd
        JOIN public.bookings b ON b.id = bd.booking_id
        WHERE b.club_id = $1
          AND tstzrange(bd.start_time, bd.end_time, '[)') &&
              tstzrange($2::timestamptz, $3::timestamptz, '[)')

        UNION

        SELECT d.id AS device_id
        FROM public.devices d
        JOIN public.device_statuses ds ON ds.id = d.status_id
        WHERE d.club_id = $1
          AND lower(ds.code) = 'repair'
      ) x
      `,
      [clubId, start, end]
    );

    res.json({
      busyDeviceIds: r.rows.map((row) => Number(row.device_id)),
    });
  } catch (e) {
    console.error("GET /api/superadmin/booking-availability error:", e);
    res.status(500).json({ message: "Failed to load booking availability" });
  }
});

router.patch("/items/:category/:id", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;
    const category = String(req.params.category || "");
    const id = Number(req.params.id);
    const body = req.body || {};
    if (!id) return res.status(400).json({ message: "id required" });

    await query("BEGIN");

    switch (category) {
      case "clubs":
        await query(
          `UPDATE public.clubs SET name=$2, city=$3, address=$4, phone=$5, work_hours=$6, latitude=$7, longitude=$8 WHERE id=$1`,
          [id, normalizeNullable(body.name), normalizeNullable(body.city), normalizeNullable(body.address), normalizeNullable(body.phone), normalizeNullable(body.work_hours), numberOrNull(body.latitude), numberOrNull(body.longitude)]
        );
        break;

      case "services":
        await query(`UPDATE public.services SET name=$2, description=$3 WHERE id=$1`, [id, normalizeNullable(body.name), normalizeNullable(body.description)]);
        break;

      case "clients": {
        const emailNorm =
          body.email != null && String(body.email).trim() !== ""
            ? String(body.email).trim().toLowerCase()
            : null;

        if (emailNorm != null && !isValidEmail(emailNorm)) {
          throw new Error("Неверный формат email");
        }

        if (body.phone != null && String(body.phone).trim() !== "" && !isValidPhone(body.phone)) {
          throw new Error("Неверный формат телефона");
        }

        const birthDateStr =
          body.birth_date != null && String(body.birth_date).trim() !== ""
            ? String(body.birth_date).trim()
            : null;

        await query(
          `
          UPDATE public.clients
          SET
            last_name = COALESCE($2, last_name),
            first_name = COALESCE($3, first_name),
            middle_name = COALESCE($4, middle_name),
            phone = COALESCE($5, phone),
            email = COALESCE($6, email),
            birth_date = COALESCE($7::date, birth_date)
          WHERE id = $1
          `,
          [
            id,
            body.last_name != null ? String(body.last_name).trim() : null,
            body.first_name != null ? String(body.first_name).trim() : null,
            body.middle_name != null ? (String(body.middle_name).trim() || null) : null,
            body.phone != null ? String(body.phone).trim() : null,
            emailNorm,
            birthDateStr,
          ]
        );

        if (emailNorm != null) {
          await query(
            `
            UPDATE public.users
            SET login = $2
            WHERE id = $1
            `,
            [id, emailNorm]
          );
        }

        break;
      }

      case "employees":
        await query(
          `UPDATE public.employees SET club_id=$2, last_name=$3, first_name=$4, middle_name=$5, phone=$6, email=$7, position=$8 WHERE id=$1`,
          [id, numberOrNull(body.club_id), normalizeNullable(body.last_name), normalizeNullable(body.first_name), normalizeNullable(body.middle_name), normalizeNullable(body.phone), normalizeNullable(body.email), normalizeNullable(body.position)]
        );
        break;

      case "users": {
        const updates = [Number(body.role_id), parseBool(body.is_active, true), normalizeNullable(body.login)?.toLowerCase(), numberOrNull(body.client_id), numberOrNull(body.employee_id), id];
        await query(`UPDATE public.users SET role_id=$1, is_active=$2, login=$3, client_id=$4, employee_id=$5 WHERE id=$6`, updates);
        const password = String(body.password || "").trim();
        if (password) {
          await query(`UPDATE public.users SET password_hash=$2 WHERE id=$1`, [id, hashPassword(password)]);
        }
        break;
      }

      case "devices": {
        await query(
          `UPDATE public.devices SET club_id=$2, type_id=$3, code=$4, status_id=$5, notes=$6 WHERE id=$1`,
          [
            id,
            Number(body.club_id),
            Number(body.type_id),
            normalizeNullable(body.code),
            Number(body.status_id),
            normalizeNullable(body.notes),
          ]
        );
        await query(`DELETE FROM public.device_pc_specs WHERE device_id=$1`, [id]);
        await query(`DELETE FROM public.device_console_specs WHERE device_id=$1`, [id]);
        await query(`DELETE FROM public.device_vr_specs WHERE device_id=$1`, [id]);
        const typeRes = await query(`SELECT code FROM public.device_types WHERE id = $1`, [Number(body.type_id)]);
        const typeCode = String(typeRes.rows[0]?.code || "").toLowerCase();
        if (typeCode === "pc") {
          await query(`INSERT INTO public.device_pc_specs (device_id, cpu, gpu, ram_gb, storage_gb, monitor_hz) VALUES ($1,$2,$3,$4,$5,$6)`, [id, normalizeNullable(body.cpu), normalizeNullable(body.gpu), numberOrNull(body.ram_gb), numberOrNull(body.storage_gb), numberOrNull(body.monitor_hz)]);
        } else if (typeCode === "console") {
          await query(`INSERT INTO public.device_console_specs (device_id, platform, controllers, display) VALUES ($1,$2,$3,$4)`, [id, normalizeNullable(body.platform), numberOrNull(body.controllers), normalizeNullable(body.display)]);
        } else if (typeCode === "vr") {
          await query(`INSERT INTO public.device_vr_specs (device_id, model, play_area) VALUES ($1,$2,$3)`, [id, normalizeNullable(body.model), normalizeNullable(body.play_area)]);
        }
        break;
      }

      case "prices":
        await query(
          `UPDATE public.service_prices
          SET service_id=$2, club_id=$3, price_per_hour=$4, price_fixed=$5, currency=$6, is_active=$7, valid_from=$8, valid_to=$9
          WHERE id=$1`,
          [
            id,
            Number(body.service_id),
            numberOrNull(body.club_id),
            numberOrNull(body.price_per_hour),
            numberOrNull(body.price_fixed),
            normalizeNullable(body.currency) || "RUB",
            parseBool(body.is_active, true),
            normalizeNullable(body.valid_from),
            normalizeNullable(body.valid_to),
          ]
        );
        break;

      case "bookings": {
        await query(
          `UPDATE public.bookings
          SET club_id=$2, client_id=$3, guest_last_name=$4, guest_first_name=$5, guest_middle_name=$6,
              guest_phone=$7, guest_email=$8, status_id=$9, service_id=$10, start_time=$11, end_time=$12,
              comment=$13, total_price=$14
          WHERE id=$1`,
          [
            id,
            Number(body.club_id),
            numberOrNull(body.client_id),
            normalizeNullable(body.guest_last_name),
            normalizeNullable(body.guest_first_name),
            normalizeNullable(body.guest_middle_name),
            normalizeNullable(body.guest_phone),
            normalizeNullable(body.guest_email),
            Number(body.status_id),
            numberOrNull(body.service_id),
            normalizeNullable(body.start_time),
            normalizeNullable(body.end_time),
            normalizeNullable(body.comment),
            numberOrNull(body.total_price),
          ]
        );
        await query(`DELETE FROM public.booking_devices WHERE booking_id=$1`, [id]);
        const deviceId = numberOrNull(body.device_id);
        if (deviceId) {
          await query(`INSERT INTO public.booking_devices (booking_id, device_id, start_time, end_time) VALUES ($1,$2,$3,$4)`, [id, deviceId, normalizeNullable(body.start_time), normalizeNullable(body.end_time)]);
        }
        break;
      }

      case "tournaments": {
        await query(`UPDATE public.tournaments SET club_id=$2, name=$3, game=$4, description=$5, status_id=$6, starts_at=$7, ends_at=$8, entry_fee=$9, prize_pool=$10 WHERE id=$1`, [id, numberOrNull(body.club_id), normalizeNullable(body.name), normalizeNullable(body.game), normalizeNullable(body.description), Number(body.status_id), normalizeNullable(body.starts_at), normalizeNullable(body.ends_at), numberOrNull(body.entry_fee) ?? 0, numberOrNull(body.prize_pool) ?? 0]);
        await query(`DELETE FROM public.tournament_teams WHERE tournament_id=$1`, [id]);
        const teamIds = Array.isArray(body.team_ids) ? body.team_ids.map(Number).filter(Boolean) : [];
        for (const teamId of teamIds) {
          await query(`INSERT INTO public.tournament_teams (tournament_id, team_id) VALUES ($1,$2)`, [id, teamId]);
        }
        break;
      }

      case "teams": {
        await query(`UPDATE public.teams SET name=$2, club_id=$3 WHERE id=$1`, [id, normalizeNullable(body.name), numberOrNull(body.club_id)]);
        await query(`DELETE FROM public.team_members WHERE team_id=$1`, [id]);
        const memberIds = Array.isArray(body.member_ids) ? body.member_ids.map(Number).filter(Boolean) : [];
        for (const memberId of memberIds) {
          await query(`INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1,$2,NULL)`, [id, memberId]);
        }
        break;
      }

      default:
        throw new Error("Unknown category");
    }

    await query("COMMIT");
    res.json({ message: "Изменения сохранены" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("PATCH /api/superadmin/items/:category/:id error:", e);
    res.status(500).json({ message: e?.message || "Failed to update item" });
  }
});

router.delete("/items/:category/:id", async (req, res) => {
  try {
    const me = await requireSuperAdmin(req, res);
    if (!me) return;
    const category = String(req.params.category || "");
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "id required" });

    await query("BEGIN");

    switch (category) {
      case "clubs":
        await query(`DELETE FROM public.clubs WHERE id=$1`, [id]);
        break;
      
      case "clients":
        await query(
          `
          UPDATE public.bookings
          SET client_id = NULL
          WHERE client_id = $1
          `,
          [id]
        );

        await query(
          `
          UPDATE public.users
          SET client_id = NULL
          WHERE id = $1
          `,
          [id]
        );

        await query(`DELETE FROM public.clients WHERE id = $1`, [id]);
        await query(`DELETE FROM public.users WHERE id = $1`, [id]);
        break;
      
      case "services":
        await query(`DELETE FROM public.services WHERE id=$1`, [id]);
        break;
      case "employees":
        await query(`UPDATE public.users SET employee_id = NULL WHERE employee_id = $1`, [id]);
        await query(`DELETE FROM public.employees WHERE id=$1`, [id]);
        break;
      case "users":
        await query(`DELETE FROM public.users WHERE id=$1`, [id]);
        break;
      case "devices":
        await query(`DELETE FROM public.devices WHERE id=$1`, [id]);
        break;
      case "prices":
        await query(`DELETE FROM public.service_prices WHERE id=$1`, [id]);
        break;
      case "bookings":
        await query(`DELETE FROM public.bookings WHERE id=$1`, [id]);
        break;
      case "tournaments":
        await query(`DELETE FROM public.tournaments WHERE id=$1`, [id]);
        break;
      case "teams":
        await query(`DELETE FROM public.teams WHERE id=$1`, [id]);
        break;
      default:
        throw new Error("Unknown category");
    }

    await query("COMMIT");
    res.json({ message: "Объект удалён" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("DELETE /api/superadmin/items/:category/:id error:", e);
    res.status(500).json({ message: e?.message || "Failed to delete item" });
  }
});

export default router;