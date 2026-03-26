import { Router } from "express";
import crypto from "crypto";
import { query } from "../db.js";
import ExcelJS from "exceljs";

const router = Router();

// =========================
// PASSWORD HASHING
// =========================
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

// =========================
// HELPERS
// =========================
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
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

function toDateOnlyISO(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function hoursBetween(startISO, endISO) {
  const a = new Date(startISO);
  const b = new Date(endISO);
  const ms = b.getTime() - a.getTime();
  return ms / 3600000;
}

function getUserIdFromReq(req) {
  return Number(
    req.query.userId ||
      req.body?.userId ||
      req.headers["x-user-id"] ||
      0
  );
}

async function getAdminContext(userId) {
  const r = await query(
    `
    SELECT
      u.id AS user_id,
      u.role_id,
      u.login,
      u.employee_id,
      e.club_id,
      e.last_name,
      e.first_name,
      e.middle_name,
      e.phone,
      e.email,
      e.position,
      c.name AS club_name,
      c.city AS club_city,
      c.address AS club_address
    FROM public.users u
    JOIN public.employees e ON e.id = u.employee_id
    JOIN public.clubs c ON c.id = e.club_id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (r.rowCount === 0) return null;
  return r.rows[0];
}

async function getServicePrice({ serviceId, clubId, onDate }) {
  const r = await query(
    `
    SELECT
      sp.id,
      sp.price_per_hour,
      sp.price_fixed,
      sp.currency
    FROM public.service_prices sp
    WHERE sp.service_id = $1
      AND sp.club_id = $2
      AND sp.is_active = TRUE
      AND sp.valid_from <= $3::date
      AND (sp.valid_to IS NULL OR sp.valid_to >= $3::date)
    ORDER BY sp.valid_from DESC
    LIMIT 1
    `,
    [serviceId, clubId, onDate]
  );

  return r.rowCount ? r.rows[0] : null;
}

async function assertDeviceInClub({ deviceId, clubId }) {
  const r = await query(
    `
    SELECT 1
    FROM public.devices d
    WHERE d.id = $1
      AND d.club_id = $2
    LIMIT 1
    `,
    [deviceId, clubId]
  );

  return r.rowCount > 0;
}

async function assertBookingInClub({ bookingId, clubId }) {
  const r = await query(
    `
    SELECT 1
    FROM public.bookings
    WHERE id = $1
      AND club_id = $2
    LIMIT 1
    `,
    [bookingId, clubId]
  );

  return r.rowCount > 0;
}

async function resolveTournamentArchiveStatusId() {
  const r = await query(
    `
    SELECT id
    FROM public.tournament_statuses
    WHERE lower(coalesce(code, '')) IN ('archived', 'archive')
       OR lower(name) IN ('архив', 'архивирован', 'архивный')
    ORDER BY id
    LIMIT 1
    `
  );

  return r.rowCount ? Number(r.rows[0].id) : null;
}

async function resolveCompletedBookingStatusIds() {
  const r = await query(
    `
    SELECT id
    FROM public.booking_statuses
    WHERE lower(coalesce(code, '')) IN ('completed', 'done', 'finished')
       OR lower(name) IN ('завершено', 'завершён', 'завершена', 'выполнено')
    ORDER BY id
    `
  );

  return r.rows.map((x) => Number(x.id)).filter(Boolean);
}

function serviceToDeviceTypeByName(serviceName) {
  const name = String(serviceName || "").toLowerCase();

  if (name.includes("vr")) return "vr";
  if (name.includes("консол")) return "console";
  if (name.includes("пк")) return "pc";

  return null;
}

async function getServiceInfo(serviceId) {
  const r = await query(
    `
    SELECT id, name
    FROM public.services
    WHERE id = $1
    LIMIT 1
    `,
    [serviceId]
  );

  return r.rowCount ? r.rows[0] : null;
}

function isWholeClubDayService(serviceName) {
  const name = String(serviceName || "").toLowerCase();
  return name.includes("всего клуба на день");
}

async function getDeviceInfo(deviceId) {
  const r = await query(
    `
    SELECT
      d.id,
      d.club_id,
      dt.code AS type_code,
      dt.name AS type_name
    FROM public.devices d
    JOIN public.device_types dt ON dt.id = d.type_id
    WHERE d.id = $1
    LIMIT 1
    `,
    [deviceId]
  );

  return r.rowCount ? r.rows[0] : null;
}

function parseWorkHoursRange(workHours) {
  const s = String(workHours || "").trim().toLowerCase();

  if (!s) return null;
  if (s === "24/7" || s === "24x7") {
    return { is24x7: true, startMinutes: 0, endMinutes: 1440 };
  }

  const m = s.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  const startMinutes = Number(m[1]) * 60 + Number(m[2]);
  const endMinutes = Number(m[3]) * 60 + Number(m[4]);

  return {
    is24x7: false,
    startMinutes,
    endMinutes,
  };
}

function getLocalMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isBookingInsideWorkHours(startISO, endISO, workHours) {
  const range = parseWorkHoursRange(workHours);
  if (!range) return { ok: true };

  if (range.is24x7) {
    return { ok: true };
  }

  const start = new Date(startISO);
  const end = new Date(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Некорректные дата или время бронирования" };
  }

  const startMin = getLocalMinutes(start);
  const endMin = getLocalMinutes(end);

  // обычный график, например 10:00–22:00
  if (range.startMinutes < range.endMinutes) {
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (!sameDay) {
      return {
        ok: false,
        message: "Бронь не может переходить на следующий день для этого клуба",
      };
    }

    if (startMin < range.startMinutes || endMin > range.endMinutes) {
      return {
        ok: false,
        message: `Бронирование доступно только в рабочие часы клуба: ${workHours}`,
      };
    }

    return { ok: true };
  }

  // ночной график, например 12:00–03:00 или 18:00–02:00
  const startsInWorkingWindow =
    startMin >= range.startMinutes || startMin < range.endMinutes;

  if (!startsInWorkingWindow) {
    return {
      ok: false,
      message: `Бронирование доступно только в рабочие часы клуба: ${workHours}`,
    };
  }

  // старт до полуночи
  if (startMin >= range.startMinutes) {
    if (endMin >= range.startMinutes) {
      // закончилась в тот же календарный день до полуночи
      return { ok: true };
    }

    // перешла через полночь — конец должен быть не позже конца смены
    if (endMin <= range.endMinutes) {
      return { ok: true };
    }

    return {
      ok: false,
      message: `Бронирование доступно только в рабочие часы клуба: ${workHours}`,
    };
  }

  // старт после полуночи — конец тоже должен быть до конца смены
  if (endMin <= range.endMinutes && endMin > startMin) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `Бронирование доступно только в рабочие часы клуба: ${workHours}`,
  };
}

function normalizeMembers(memberIds) {
  if (!Array.isArray(memberIds)) return [];
  return [...new Set(memberIds.map((x) => Number(x)).filter(Boolean))];
}

async function validateTeamMembers(memberIds) {
  const members = normalizeMembers(memberIds);

  if (members.length !== 5) {
    return {
      ok: false,
      message: "В команде должно быть ровно 5 участников",
    };
  }

  const r = await query(
    `
    SELECT u.id
    FROM public.users u
    WHERE u.id = ANY($1::bigint[])
      AND u.role_id = 2
      AND u.client_id IS NOT NULL
      AND u.is_active = TRUE
    `,
    [members]
  );

  if (r.rowCount !== 5) {
    return {
      ok: false,
      message: "Все участники команды должны быть авторизованными клиентами",
    };
  }

  return { ok: true, members };
}

async function resolveCompletedTournamentStatusIds() {
  const r = await query(
    `
    SELECT id
    FROM public.tournament_statuses
    WHERE lower(coalesce(code, '')) IN ('completed', 'done', 'finished')
       OR lower(name) IN ('завершено', 'завершён', 'завершена', 'завершен')
    ORDER BY id
    `
  );

  return r.rows.map((x) => Number(x.id)).filter(Boolean);
}

function isFutureDateTime(value) {
  if (!value) return false;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() > Date.now();
}


router.get("/device-statuses", async (_req, res) => {
  try {
    const r = await query(`
      SELECT id, code, name
      FROM public.device_statuses
      ORDER BY id
    `);

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/device-statuses error:", e);
    res.status(500).json({ message: "Failed to load device statuses" });
  }
});

router.get("/device-types", async (_req, res) => {
  try {
    const r = await query(`
      SELECT id, code, name
      FROM public.device_types
      ORDER BY id
    `);

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/device-types error:", e);
    res.status(500).json({ message: "Failed to load device types" });
  }
});

router.post("/devices", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const {
    code,
    typeId,
    statusId,
    notes,

    cpu,
    gpu,
    ramGb,
    storageGb,
    monitorHz,

    platform,
    controllers,
    display,

    model,
    playArea,
  } = req.body || {};

  if (!userId || !code || !typeId || !statusId) {
    return res.status(400).json({ message: "userId, code, typeId, statusId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const exists = await query(
      `
      SELECT 1
      FROM public.devices
      WHERE club_id = $1
        AND lower(code) = lower($2)
      LIMIT 1
      `,
      [ctx.club_id, String(code).trim()]
    );

    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Устройство с таким кодом уже есть в клубе" });
    }

    await query("BEGIN");

    const ins = await query(
      `
      INSERT INTO public.devices (
        club_id,
        type_id,
        code,
        status_id,
        notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        ctx.club_id,
        Number(typeId),
        String(code).trim(),
        Number(statusId),
        notes ? String(notes).trim() : null,
      ]
    );

    const deviceId = Number(ins.rows[0].id);

    const typeRes = await query(
      `
      SELECT code
      FROM public.device_types
      WHERE id = $1
      LIMIT 1
      `,
      [Number(typeId)]
    );

    const typeCode = typeRes.rowCount ? String(typeRes.rows[0].code).toLowerCase() : null;

    if (typeCode === "pc") {
      await query(
        `
        INSERT INTO public.device_pc_specs (
          device_id, cpu, gpu, ram_gb, storage_gb, monitor_hz
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          deviceId,
          cpu || null,
          gpu || null,
          ramGb === "" || ramGb == null ? null : Number(ramGb),
          storageGb === "" || storageGb == null ? null : Number(storageGb),
          monitorHz === "" || monitorHz == null ? null : Number(monitorHz),
        ]
      );
    } else if (typeCode === "console") {
      await query(
        `
        INSERT INTO public.device_console_specs (
          device_id, platform, controllers, display
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          deviceId,
          platform || null,
          controllers === "" || controllers == null ? null : Number(controllers),
          display || null,
        ]
      );
    } else if (typeCode === "vr") {
      await query(
        `
        INSERT INTO public.device_vr_specs (
          device_id, model, play_area
        )
        VALUES ($1, $2, $3)
        `,
        [
          deviceId,
          model || null,
          playArea || null,
        ]
      );
    }

    await query("COMMIT");

    res.json({
      deviceId,
      message: "Устройство создано",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/admin/devices error:", e);
    res.status(500).json({ message: "Failed to create device" });
  }
});

router.get("/teams", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT
        t.id,
        t.name,
        t.club_id,
        t.created_by,
        t.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'userId', u.id,
              'clientId', u.client_id,
              'fullName',
                trim(
                  coalesce(c.last_name, '') || ' ' ||
                  coalesce(c.first_name, '') || ' ' ||
                  coalesce(c.middle_name, '')
                ),
              'email', c.email,
              'phone', c.phone,
              'role', tm.role
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS members
      FROM public.teams t
      LEFT JOIN public.team_members tm ON tm.team_id = t.id
      LEFT JOIN public.users u ON u.id = tm.user_id
      LEFT JOIN public.clients c ON c.id = u.client_id
      WHERE t.club_id = $1
      GROUP BY t.id
      ORDER BY t.name, t.id
      `,
      [ctx.club_id]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/teams error:", e);
    res.status(500).json({ message: "Failed to load teams" });
  }
});


router.get("/team-clients", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT DISTINCT
        u.id AS user_id,
        u.client_id,
        trim(
          coalesce(c.last_name, '') || ' ' ||
          coalesce(c.first_name, '') || ' ' ||
          coalesce(c.middle_name, '')
        ) AS full_name,
        c.email,
        c.phone
      FROM public.users u
      JOIN public.clients c ON c.id = u.client_id
      WHERE u.role_id = 2
        AND u.client_id IS NOT NULL
        AND u.is_active = TRUE
        AND EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.client_id = u.client_id
            AND b.club_id = $1
        )
      ORDER BY full_name, u.id
      `,
      [ctx.club_id]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/team-clients error:", e);
    res.status(500).json({ message: "Failed to load team clients" });
  }
});


router.post("/teams", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const { name, memberIds } = req.body || {};

  if (!userId || !name) {
    return res.status(400).json({ message: "userId, name required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const valid = await validateTeamMembers(memberIds);
    if (!valid.ok) {
      return res.status(400).json({ message: valid.message });
    }

    const dup = await query(
      `
      SELECT 1
      FROM public.teams
      WHERE club_id = $1
        AND lower(name) = lower($2)
      LIMIT 1
      `,
      [ctx.club_id, String(name).trim()]
    );

    if (dup.rowCount > 0) {
      return res.status(409).json({ message: "Команда с таким названием уже существует" });
    }

    await query("BEGIN");

    const ins = await query(
      `
      INSERT INTO public.teams (name, club_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [String(name).trim(), ctx.club_id, userId]
    );

    const teamId = Number(ins.rows[0].id);

    for (const memberUserId of valid.members) {
      await query(
        `
        INSERT INTO public.team_members (team_id, user_id, role)
        VALUES ($1, $2, NULL)
        `,
        [teamId, memberUserId]
      );
    }

    await query("COMMIT");

    res.json({
      teamId,
      message: "Команда создана",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/admin/teams error:", e);
    res.status(500).json({ message: "Failed to create team" });
  }
});


router.patch("/teams/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const teamId = Number(req.params.id);
  const { name, memberIds } = req.body || {};

  if (!userId || !teamId) {
    return res.status(400).json({ message: "userId and team id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const teamCheck = await query(
      `
      SELECT 1
      FROM public.teams
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [teamId, ctx.club_id]
    );

    if (teamCheck.rowCount === 0) {
      return res.status(404).json({ message: "Team not found in admin club" });
    }

    const valid = await validateTeamMembers(memberIds);
    if (!valid.ok) {
      return res.status(400).json({ message: valid.message });
    }

    if (name != null) {
      const dup = await query(
        `
        SELECT 1
        FROM public.teams
        WHERE club_id = $1
          AND lower(name) = lower($2)
          AND id <> $3
        LIMIT 1
        `,
        [ctx.club_id, String(name).trim(), teamId]
      );

      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Команда с таким названием уже существует" });
      }
    }

    await query("BEGIN");

    await query(
      `
      UPDATE public.teams
      SET name = COALESCE($2, name)
      WHERE id = $1
      `,
      [teamId, name != null ? String(name).trim() : null]
    );

    await query(`DELETE FROM public.team_members WHERE team_id = $1`, [teamId]);

    for (const memberUserId of valid.members) {
      await query(
        `
        INSERT INTO public.team_members (team_id, user_id, role)
        VALUES ($1, $2, NULL)
        `,
        [teamId, memberUserId]
      );
    }

    await query("COMMIT");

    res.json({ message: "Команда обновлена" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("PATCH /api/admin/teams/:id error:", e);
    res.status(500).json({ message: "Failed to update team" });
  }
});


router.get("/reports/bookings/export", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const dateFrom = req.query.dateFrom || null;
  const dateTo = req.query.dateTo || null;

  if (!userId) {
    return res.status(400).send("userId required");
  }

  if (!dateFrom || !dateTo) {
    return res.status(400).send("dateFrom and dateTo are required");
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).send("Invalid report period");
  }

  if (to < from) {
    return res.status(400).send("dateTo must be greater than or equal to dateFrom");
  }

  const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (diffDays < 1 || diffDays > 366) {
    return res.status(400).send("Период отчёта должен быть от 1 дня до 1 года");
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).send("Admin context not found");
    }

    const completedStatusIds = await resolveCompletedBookingStatusIds();
    if (!completedStatusIds.length) {
      return res.status(400).send("Completed booking status not found");
    }

    const r = await query(
      `
      SELECT
        b.id,
        b.start_time,
        b.end_time,
        trim(
          coalesce(c.last_name, b.guest_last_name, '') || ' ' ||
          coalesce(c.first_name, b.guest_first_name, '') || ' ' ||
          coalesce(c.middle_name, b.guest_middle_name, '')
        ) AS client_full_name,
        coalesce(c.email, b.guest_email) AS client_email,
        coalesce(
          string_agg(d.code, ', ' ORDER BY d.code) FILTER (WHERE d.id IS NOT NULL),
          '—'
        ) AS device_code,
        round(extract(epoch from (b.end_time - b.start_time)) / 3600.0, 2) AS hours_count,
        coalesce(b.total_price, 0)::numeric(12,2) AS price
      FROM public.bookings b
      LEFT JOIN public.clients c ON c.id = b.client_id
      LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
      LEFT JOIN public.devices d ON d.id = bd.device_id
      WHERE b.club_id = $1
        AND b.status_id = ANY($2::smallint[])
        AND b.end_time::date >= $3::date
        AND b.end_time::date <= $4::date
      GROUP BY
        b.id,
        b.start_time,
        b.end_time,
        c.last_name,
        c.first_name,
        c.middle_name,
        c.email,
        b.guest_last_name,
        b.guest_first_name,
        b.guest_middle_name,
        b.guest_email,
        b.total_price
      ORDER BY b.end_time DESC, b.id DESC
      `,
      [ctx.club_id, completedStatusIds, dateFrom, dateTo]
    );

    const total = await query(
      `
      SELECT
        COUNT(*)::int AS bookings_count,
        COALESCE(SUM(b.total_price), 0)::numeric(12,2) AS profit_sum
      FROM public.bookings b
      WHERE b.club_id = $1
        AND b.status_id = ANY($2::smallint[])
        AND b.end_time::date >= $3::date
        AND b.end_time::date <= $4::date
      `,
      [ctx.club_id, completedStatusIds, dateFrom, dateTo]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Завершённые сеансы");

    sheet.columns = [
      { header: "ID брони", key: "id", width: 12 },
      { header: "Начало", key: "start_time", width: 22 },
      { header: "Окончание", key: "end_time", width: 22 },
      { header: "ФИО клиента", key: "client_full_name", width: 32 },
      { header: "Почта", key: "client_email", width: 30 },
      { header: "Место", key: "device_code", width: 18 },
      { header: "Часов", key: "hours_count", width: 12 },
      { header: "Цена", key: "price", width: 14 },
    ];

    r.rows.forEach((row) => {
      sheet.addRow({
        id: row.id,
        start_time: row.start_time,
        end_time: row.end_time,
        client_full_name: row.client_full_name || "—",
        client_email: row.client_email || "—",
        device_code: row.device_code || "—",
        hours_count: Number(row.hours_count || 0),
        price: Number(row.price || 0),
      });
    });

    sheet.addRow({});
    sheet.addRow({
      client_full_name: "ИТОГО",
      hours_count: Number(total.rows[0]?.bookings_count || 0),
      price: Number(total.rows[0]?.profit_sum || 0),
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(sheet.rowCount).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="completed-bookings-${dateFrom}-${dateTo}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("GET /api/admin/reports/bookings/export error:", e);
    res.status(500).send("Failed to export booking report");
  }
});

router.get("/reports/bookings", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const dateFrom = req.query.dateFrom || null;
  const dateTo = req.query.dateTo || null;

  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  if (!dateFrom || !dateTo) {
    return res.status(400).json({ message: "dateFrom and dateTo are required" });
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ message: "Invalid report period" });
  }

  if (to < from) {
    return res.status(400).json({ message: "dateTo must be greater than or equal to dateFrom" });
  }

  const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (diffDays < 1 || diffDays > 366) {
    return res.status(400).json({ message: "Период отчёта должен быть от 1 дня до 1 года" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const completedStatusIds = await resolveCompletedBookingStatusIds();
    if (!completedStatusIds.length) {
      return res.json({
        items: [],
        total: {
          bookings_count: 0,
          profit_sum: "0.00",
        },
      });
    }

    const r = await query(
      `
      SELECT
        b.id,
        b.start_time,
        b.end_time,
        trim(
          coalesce(c.last_name, b.guest_last_name, '') || ' ' ||
          coalesce(c.first_name, b.guest_first_name, '') || ' ' ||
          coalesce(c.middle_name, b.guest_middle_name, '')
        ) AS client_full_name,
        coalesce(c.email, b.guest_email) AS client_email,
        coalesce(
          string_agg(d.code, ', ' ORDER BY d.code) FILTER (WHERE d.id IS NOT NULL),
          '—'
        ) AS device_code,
        round(extract(epoch from (b.end_time - b.start_time)) / 3600.0, 2) AS hours_count,
        coalesce(b.total_price, 0)::numeric(12,2) AS price
      FROM public.bookings b
      LEFT JOIN public.clients c ON c.id = b.client_id
      LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
      LEFT JOIN public.devices d ON d.id = bd.device_id
      WHERE b.club_id = $1
        AND b.status_id = ANY($2::smallint[])
        AND b.end_time::date >= $3::date
        AND b.end_time::date <= $4::date
      GROUP BY
        b.id,
        b.start_time,
        b.end_time,
        c.last_name,
        c.first_name,
        c.middle_name,
        c.email,
        b.guest_last_name,
        b.guest_first_name,
        b.guest_middle_name,
        b.guest_email,
        b.total_price
      ORDER BY b.end_time DESC, b.id DESC
      `,
      [ctx.club_id, completedStatusIds, dateFrom, dateTo]
    );

    const total = await query(
      `
      SELECT
        COUNT(*)::int AS bookings_count,
        COALESCE(SUM(b.total_price), 0)::numeric(12,2) AS profit_sum
      FROM public.bookings b
      WHERE b.club_id = $1
        AND b.status_id = ANY($2::smallint[])
        AND b.end_time::date >= $3::date
        AND b.end_time::date <= $4::date
      `,
      [ctx.club_id, completedStatusIds, dateFrom, dateTo]
    );

    res.json({
      items: r.rows,
      total: total.rows[0],
    });
  } catch (e) {
    console.error("GET /api/admin/reports/bookings error:", e);
    res.status(500).json({ message: "Failed to load booking report" });
  }
});

router.delete("/teams/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const teamId = Number(req.params.id);

  if (!userId || !teamId) {
    return res.status(400).json({ message: "userId and team id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.teams
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [teamId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Team not found in admin club" });
    }

    await query("BEGIN");
    await query(`DELETE FROM public.team_members WHERE team_id = $1`, [teamId]);
    await query(`DELETE FROM public.tournament_teams WHERE team_id = $1`, [teamId]);
    await query(`DELETE FROM public.teams WHERE id = $1`, [teamId]);
    await query("COMMIT");

    res.json({ message: "Команда удалена" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("DELETE /api/admin/teams/:id error:", e);
    res.status(500).json({ message: "Failed to delete team" });
  }
});

router.patch("/devices/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const deviceId = Number(req.params.id);
  const {
    code,
    typeId,
    statusId,
    notes,

    cpu,
    gpu,
    ramGb,
    storageGb,
    monitorHz,

    platform,
    controllers,
    display,

    model,
    playArea,
  } = req.body || {};

  if (!userId || !deviceId) {
    return res.status(400).json({ message: "userId and device id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.devices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [deviceId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Device not found in admin club" });
    }

    if (code != null) {
      const dup = await query(
        `
        SELECT 1
        FROM public.devices
        WHERE club_id = $1
          AND lower(code) = lower($2)
          AND id <> $3
        LIMIT 1
        `,
        [ctx.club_id, String(code).trim(), deviceId]
      );

      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Устройство с таким кодом уже есть в клубе" });
      }
    }

    await query("BEGIN");

    await query(
      `
      UPDATE public.devices
      SET
        code = COALESCE($2, code),
        type_id = COALESCE($3, type_id),
        status_id = COALESCE($4, status_id),
        notes = COALESCE($5, notes)
      WHERE id = $1
      `,
      [
        deviceId,
        code != null ? String(code).trim() : null,
        typeId != null ? Number(typeId) : null,
        statusId != null ? Number(statusId) : null,
        notes != null ? String(notes).trim() : null,
      ]
    );

    const typeRes = await query(
      `
      SELECT dt.code
      FROM public.devices d
      JOIN public.device_types dt ON dt.id = d.type_id
      WHERE d.id = $1
      LIMIT 1
      `,
      [deviceId]
    );

    const typeCode = typeRes.rowCount ? String(typeRes.rows[0].code).toLowerCase() : null;

    if (typeCode === "pc") {
      await query(`DELETE FROM public.device_pc_specs WHERE device_id = $1`, [deviceId]);
      await query(
        `
        INSERT INTO public.device_pc_specs (
          device_id, cpu, gpu, ram_gb, storage_gb, monitor_hz
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          deviceId,
          cpu || null,
          gpu || null,
          ramGb === "" || ramGb == null ? null : Number(ramGb),
          storageGb === "" || storageGb == null ? null : Number(storageGb),
          monitorHz === "" || monitorHz == null ? null : Number(monitorHz),
        ]
      );

      await query(`DELETE FROM public.device_console_specs WHERE device_id = $1`, [deviceId]);
      await query(`DELETE FROM public.device_vr_specs WHERE device_id = $1`, [deviceId]);
    } else if (typeCode === "console") {
      await query(`DELETE FROM public.device_console_specs WHERE device_id = $1`, [deviceId]);
      await query(
        `
        INSERT INTO public.device_console_specs (
          device_id, platform, controllers, display
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          deviceId,
          platform || null,
          controllers === "" || controllers == null ? null : Number(controllers),
          display || null,
        ]
      );

      await query(`DELETE FROM public.device_pc_specs WHERE device_id = $1`, [deviceId]);
      await query(`DELETE FROM public.device_vr_specs WHERE device_id = $1`, [deviceId]);
    } else if (typeCode === "vr") {
      await query(`DELETE FROM public.device_vr_specs WHERE device_id = $1`, [deviceId]);
      await query(
        `
        INSERT INTO public.device_vr_specs (
          device_id, model, play_area
        )
        VALUES ($1, $2, $3)
        `,
        [
          deviceId,
          model || null,
          playArea || null,
        ]
      );

      await query(`DELETE FROM public.device_pc_specs WHERE device_id = $1`, [deviceId]);
      await query(`DELETE FROM public.device_console_specs WHERE device_id = $1`, [deviceId]);
    }

    await query("COMMIT");

    res.json({ message: "Устройство обновлено" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("PATCH /api/admin/devices/:id error:", e);
    res.status(500).json({ message: "Failed to update device" });
  }
});

router.delete("/devices/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const deviceId = Number(req.params.id);

  if (!userId || !deviceId) {
    return res.status(400).json({ message: "userId and device id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.devices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [deviceId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Device not found in admin club" });
    }

    await query(`DELETE FROM public.devices WHERE id = $1`, [deviceId]);

    res.json({ message: "Устройство удалено" });
  } catch (e) {
    console.error("DELETE /api/admin/devices/:id error:", e);
    res.status(500).json({ message: "Failed to delete device" });
  }
});

// =========================
// ADMIN PROFILE
// =========================
router.get("/me", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const fullName = [ctx.last_name, ctx.first_name, ctx.middle_name]
      .filter(Boolean)
      .join(" ");

    res.json({
      admin: {
        userId: ctx.user_id,
        roleId: ctx.role_id,
        login: ctx.login,
        employeeId: ctx.employee_id,
        clubId: ctx.club_id,
        clubName: ctx.club_name,
        clubCity: ctx.club_city,
        clubAddress: ctx.club_address,
        lastName: ctx.last_name,
        firstName: ctx.first_name,
        middleName: ctx.middle_name,
        fullName,
        phone: ctx.phone,
        email: ctx.email,
        position: ctx.position,
      },
    });
  } catch (e) {
    console.error("GET /api/admin/me error:", e);
    res.status(500).json({ message: "Failed to load admin profile" });
  }
});

router.get("/devices", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT
        d.id,
        d.code,
        d.status_id,
        ds.code AS status_code,
        ds.name AS status_name,
        d.notes,

        dt.id AS type_id,
        dt.code AS type_code,
        dt.name AS type_name,

        pcs.cpu,
        pcs.gpu,
        pcs.ram_gb,
        pcs.storage_gb,
        pcs.monitor_hz,

        vcs.platform,
        vcs.controllers,
        vcs.display,

        vrs.model,
        vrs.play_area
      FROM public.devices d
      JOIN public.device_types dt ON dt.id = d.type_id
      JOIN public.device_statuses ds ON ds.id = d.status_id
      LEFT JOIN public.device_pc_specs pcs ON pcs.device_id = d.id
      LEFT JOIN public.device_console_specs vcs ON vcs.device_id = d.id
      LEFT JOIN public.device_vr_specs vrs ON vrs.device_id = d.id
      WHERE d.club_id = $1
      ORDER BY dt.id, d.id
      `,
      [ctx.club_id]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/devices error:", e);
    res.status(500).json({ message: "Failed to load devices" });
  }
});

router.get("/booking-availability", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const start = req.query.start;
  const end = req.query.end;

  if (!userId || !start || !end) {
    return res.status(400).json({ message: "userId, start, end required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
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
      [ctx.club_id, start, end]
    );

    res.json({
      busyDeviceIds: r.rows.map((row) => Number(row.device_id)),
    });
  } catch (e) {
    console.error("GET /api/admin/booking-availability error:", e);
    res.status(500).json({ message: "Failed to load availability" });
  }
});

// =========================
// DICTS
// =========================
router.get("/booking-statuses", async (_req, res) => {
  try {
    const r = await query(
      `
      SELECT id, code, name
      FROM public.booking_statuses
      ORDER BY id
      `
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/booking-statuses error:", e);
    res.status(500).json({ message: "Failed to load booking statuses" });
  }
});

router.get("/tournament-statuses", async (_req, res) => {
  try {
    const r = await query(
      `
      SELECT id, code, name
      FROM public.tournament_statuses
      ORDER BY id
      `
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/tournament-statuses error:", e);
    res.status(500).json({ message: "Failed to load tournament statuses" });
  }
});

router.get("/services-dict", async (_req, res) => {
  try {
    const r = await query(
      `
      SELECT id, name, description
      FROM public.services
      ORDER BY name
      `
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/services-dict error:", e);
    res.status(500).json({ message: "Failed to load services dictionary" });
  }
});

// =========================
// BOOKINGS
// =========================
router.get("/bookings", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT
        b.id,
        b.club_id,
        b.client_id,
        b.guest_last_name,
        b.guest_first_name,
        b.guest_middle_name,
        b.guest_phone,
        b.status_id,
        bs.code AS status_code,
        bs.name AS status_name,
        b.service_id,
        s.name AS service_name,
        b.start_time,
        b.end_time,
        b.comment,
        b.total_price,
        b.created_at,

        cl.last_name AS client_last_name,
        cl.first_name AS client_first_name,
        cl.middle_name AS client_middle_name,
        cl.phone AS client_phone,
        cl.email AS client_email,

        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'code', d.code,
              'type_name', dt.name
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS devices
      FROM public.bookings b
      JOIN public.booking_statuses bs ON bs.id = b.status_id
      LEFT JOIN public.services s ON s.id = b.service_id
      LEFT JOIN public.clients cl ON cl.id = b.client_id
      LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
      LEFT JOIN public.devices d ON d.id = bd.device_id
      LEFT JOIN public.device_types dt ON dt.id = d.type_id
      WHERE b.club_id = $1
      GROUP BY
        b.id, bs.id, s.id, cl.id, s.name
      ORDER BY b.start_time DESC, b.id DESC
      LIMIT 300
      `,
      [ctx.club_id]
    );

    const items = r.rows.map((row) => ({
      ...row,
      client_full_name: row.client_id
        ? [row.client_last_name, row.client_first_name, row.client_middle_name]
            .filter(Boolean)
            .join(" ")
        : null,
      guest_full_name:
        [row.guest_last_name, row.guest_first_name, row.guest_middle_name]
          .filter(Boolean)
          .join(" ") || null,
    }));

    res.json({ items });
  } catch (e) {
    console.error("GET /api/admin/bookings error:", e);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

router.post("/bookings", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const {
    clientId,
    guestLastName,
    guestFirstName,
    guestMiddleName,
    guestPhone,
    serviceId,
    deviceId,
    startTime,
    endTime,
    statusId,
    comment,
  } = req.body || {};

  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  if (!serviceId || !startTime || !endTime) {
    return res.status(400).json({
      message: "serviceId, startTime, endTime are required",
    });
  }

  const bookingClientId = clientId ? Number(clientId) : null;
  const bookingDeviceId = deviceId ? Number(deviceId) : null;
  const bookingServiceId = Number(serviceId);
  const bookingStatusId = Number(statusId) || 1;

  if (!bookingServiceId) {
    return res.status(400).json({ message: "Invalid serviceId" });
  }

  if (bookingClientId == null) {
    if (!guestLastName || !guestFirstName || !guestPhone) {
      return res.status(400).json({
        message:
          "For guest booking guestLastName, guestFirstName and guestPhone are required",
      });
    }

    if (!isValidPhone(guestPhone)) {
      return res.status(400).json({ message: "Неверный формат телефона гостя" });
    }
  }

  const hrs = hoursBetween(startTime, endTime);
  if (!Number.isFinite(hrs) || hrs <= 0) {
    return res.status(400).json({ message: "Окончание должно быть позже начала" });
  }

  const onDate = toDateOnlyISO(startTime);
  if (!onDate) {
    return res.status(400).json({ message: "Invalid startTime" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    await query("BEGIN");

    const clubRes = await query(
      `
      SELECT work_hours
      FROM public.clubs
      WHERE id = $1
      LIMIT 1
      `,
      [ctx.club_id]
    );

    if (clubRes.rowCount === 0) {
      await query("ROLLBACK");
      return res.status(404).json({ message: "Клуб не найден" });
    }

    const clubWorkHours = clubRes.rows[0].work_hours || null;

    const service = await getServiceInfo(bookingServiceId);
    if (!service) {
      await query("ROLLBACK");
      return res.status(400).json({ message: "Service not found" });
    }

    const isWholeDayBooking = isWholeClubDayService(service.name);
    const requiredType = isWholeDayBooking ? null : serviceToDeviceTypeByName(service.name);

    if (!isWholeDayBooking) {
      const workHoursCheck = isBookingInsideWorkHours(startTime, endTime, clubWorkHours);
      if (!workHoursCheck.ok) {
        await query("ROLLBACK");
        return res.status(400).json({ message: workHoursCheck.message });
      }
    }

    let device = null;

    if (requiredType) {
      if (!bookingDeviceId) {
        await query("ROLLBACK");
        return res.status(400).json({
          message: "Для выбранной услуги нужно выбрать устройство",
        });
      }

      const okDevice = await assertDeviceInClub({
        deviceId: bookingDeviceId,
        clubId: ctx.club_id,
      });

      if (!okDevice) {
        await query("ROLLBACK");
        return res.status(400).json({ message: "Device does not belong to admin club" });
      }

      device = await getDeviceInfo(bookingDeviceId);
      if (!device) {
        await query("ROLLBACK");
        return res.status(400).json({ message: "Device not found" });
      }

      if (String(device.type_code || "").toLowerCase() !== requiredType) {
        await query("ROLLBACK");
        return res.status(400).json({
          message: "Выбранное устройство не подходит для этой услуги",
        });
      }
    }

    const price = await getServicePrice({
      serviceId: bookingServiceId,
      clubId: ctx.club_id,
      onDate,
    });

    if (!price) {
      await query("ROLLBACK");
      return res.status(400).json({ message: "Price not found for selected service" });
    }

    const perHour = price.price_per_hour != null ? Number(price.price_per_hour) : 0;
    const fixed = price.price_fixed != null ? Number(price.price_fixed) : 0;
    const total = Math.round((perHour * hrs + fixed) * 100) / 100;

    if (!isWholeDayBooking) {
      const wholeDayConflict = await query(
        `
        SELECT 1
        FROM public.bookings b
        JOIN public.services s ON s.id = b.service_id
        WHERE b.club_id = $1
          AND lower(s.name) LIKE '%всего клуба на день%'
          AND tstzrange(b.start_time, b.end_time, '[)') &&
              tstzrange($2::timestamptz, $3::timestamptz, '[)')
        LIMIT 1
        `,
        [ctx.club_id, startTime, endTime]
      );

      if (wholeDayConflict.rowCount > 0) {
        await query("ROLLBACK");
        return res.status(409).json({
          message: "Клуб уже забронирован на весь день на эту дату.",
        });
      }
    }

    if (requiredType) {
      const conflict = await query(
        `
        SELECT 1
        FROM public.booking_devices bd
        JOIN public.bookings b ON b.id = bd.booking_id
        WHERE b.club_id = $1
          AND bd.device_id = $2
          AND tstzrange(bd.start_time, bd.end_time, '[)') &&
              tstzrange($3::timestamptz, $4::timestamptz, '[)')
        LIMIT 1
        `,
        [ctx.club_id, bookingDeviceId, startTime, endTime]
      );

      if (conflict.rowCount > 0) {
        await query("ROLLBACK");
        return res.status(409).json({ message: "Выбранное место уже занято на это время" });
      }
    }

    const ins = await query(
      `
      INSERT INTO public.bookings (
        club_id,
        client_id,
        guest_last_name,
        guest_first_name,
        guest_middle_name,
        guest_phone,
        status_id,
        service_id,
        start_time,
        end_time,
        comment,
        total_price
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::timestamptz,
        $10::timestamptz,
        $11,
        $12::numeric
      )
      RETURNING id
      `,
      [
        ctx.club_id,
        bookingClientId,
        bookingClientId == null ? String(guestLastName).trim() : null,
        bookingClientId == null ? String(guestFirstName).trim() : null,
        bookingClientId == null
          ? (String(guestMiddleName || "").trim() || null)
          : null,
        bookingClientId == null ? String(guestPhone).trim() : null,
        bookingStatusId,
        bookingServiceId,
        startTime,
        endTime,
        comment ?? null,
        total,
      ]
    );

    const bookingId = Number(ins.rows[0].id);

    if (requiredType && bookingDeviceId) {
      await query(
        `
        INSERT INTO public.booking_devices (booking_id, device_id, start_time, end_time)
        VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
        `,
        [bookingId, bookingDeviceId, startTime, endTime]
      );
    }

    await query("COMMIT");

    res.json({
      bookingId,
      totalPrice: total,
      message: "Booking created",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/admin/bookings error:", e);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const bookingId = Number(req.params.id);
  const {
    startTime,
    endTime,
    statusId,
    comment,
  } = req.body || {};

  if (!userId || !bookingId) {
    return res.status(400).json({ message: "userId and booking id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const ok = await assertBookingInClub({ bookingId, clubId: ctx.club_id });
    if (!ok) {
      return res.status(404).json({ message: "Booking not found in admin club" });
    }

    if (startTime || endTime) {
      const currentBookingRes = await query(
        `
        SELECT
          b.start_time,
          b.end_time,
          b.service_id,
          s.name AS service_name
        FROM public.bookings b
        LEFT JOIN public.services s ON s.id = b.service_id
        WHERE b.id = $1
        LIMIT 1
        `,
        [bookingId]
      );

      if (currentBookingRes.rowCount === 0) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const nextStart = startTime ?? currentBookingRes.rows[0].start_time;
      const nextEnd = endTime ?? currentBookingRes.rows[0].end_time;
      const currentServiceName = currentBookingRes.rows[0].service_name || "";
      const isWholeDayBooking = isWholeClubDayService(currentServiceName);

      const clubRes = await query(
        `
        SELECT work_hours
        FROM public.clubs
        WHERE id = $1
        LIMIT 1
        `,
        [ctx.club_id]
      );

      const clubWorkHours = clubRes.rowCount ? clubRes.rows[0].work_hours : null;

      if (!isWholeDayBooking) {
        const workHoursCheck = isBookingInsideWorkHours(nextStart, nextEnd, clubWorkHours);
        if (!workHoursCheck.ok) {
          return res.status(400).json({ message: workHoursCheck.message });
        }
      }

      if (isWholeDayBooking) {
        const dayStart = new Date(nextStart);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const conflict = await query(
          `
          SELECT 1
          FROM public.bookings b
          WHERE b.club_id = $1
            AND b.id <> $2
            AND tstzrange(b.start_time, b.end_time, '[)') &&
                tstzrange($3::timestamptz, $4::timestamptz, '[)')
          LIMIT 1
          `,
          [ctx.club_id, bookingId, dayStart.toISOString(), dayEnd.toISOString()]
        );

        if (conflict.rowCount > 0) {
          return res.status(409).json({
            message: "На эту дату уже есть другие бронирования клуба. Бронирование клуба на весь день недоступно.",
          });
        }
      } else {
        const wholeDayConflict = await query(
          `
          SELECT 1
          FROM public.bookings b
          JOIN public.services s ON s.id = b.service_id
          WHERE b.club_id = $1
            AND b.id <> $2
            AND lower(s.name) LIKE '%всего клуба на день%'
            AND tstzrange(b.start_time, b.end_time, '[)') &&
                tstzrange($3::timestamptz, $4::timestamptz, '[)')
          LIMIT 1
          `,
          [ctx.club_id, bookingId, nextStart, nextEnd]
        );

        if (wholeDayConflict.rowCount > 0) {
          return res.status(409).json({
            message: "Клуб уже забронирован на весь день на эту дату.",
          });
        }
      }
    }

    await query(
      `
      UPDATE public.bookings
      SET
        start_time = COALESCE($2::timestamptz, start_time),
        end_time = COALESCE($3::timestamptz, end_time),
        status_id = COALESCE($4::smallint, status_id),
        comment = COALESCE($5, comment)
      WHERE id = $1
      `,
      [
        bookingId,
        startTime ?? null,
        endTime ?? null,
        statusId ? Number(statusId) : null,
        comment ?? null,
      ]
    );

    if (startTime && endTime) {
      await query(
        `
        UPDATE public.booking_devices
        SET
          start_time = $2::timestamptz,
          end_time = $3::timestamptz
        WHERE booking_id = $1
        `,
        [bookingId, startTime, endTime]
      );
    }

    res.json({ message: "Booking updated" });
  } catch (e) {
    console.error("PATCH /api/admin/bookings/:id error:", e);
    res.status(500).json({ message: "Failed to update booking" });
  }
});

router.patch("/bookings/:id/status", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const bookingId = Number(req.params.id);
  const statusId = Number(req.body?.statusId);

  if (!userId || !bookingId || !statusId) {
    return res.status(400).json({ message: "userId, booking id and statusId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const ok = await assertBookingInClub({ bookingId, clubId: ctx.club_id });
    if (!ok) {
      return res.status(404).json({ message: "Booking not found in admin club" });
    }

    await query(
      `
      UPDATE public.bookings
      SET status_id = $2
      WHERE id = $1
      `,
      [bookingId, statusId]
    );

    res.json({ message: "Booking status updated" });
  } catch (e) {
    console.error("PATCH /api/admin/bookings/:id/status error:", e);
    res.status(500).json({ message: "Failed to update booking status" });
  }
});

// =========================
// CLIENTS
// =========================
router.get("/clients", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT DISTINCT
        c.id,
        c.last_name,
        c.first_name,
        c.middle_name,
        c.phone,
        c.email,
        c.birth_date,
        c.created_at
      FROM public.clients c
      JOIN public.bookings b ON b.client_id = c.id
      WHERE b.club_id = $1
      ORDER BY c.last_name, c.first_name, c.id
      `,
      [ctx.club_id]
    );

    const items = r.rows.map((row) => ({
      ...row,
      full_name: [row.last_name, row.first_name, row.middle_name]
        .filter(Boolean)
        .join(" "),
    }));

    res.json({ items });
  } catch (e) {
    console.error("GET /api/admin/clients error:", e);
    res.status(500).json({ message: "Failed to load clients" });
  }
});

router.post("/clients", async (req, res) => {
  const {
    userId,
    password,
    lastName,
    firstName,
    middleName,
    phone,
    email,
    birthDate,
  } = req.body || {};

  const adminUserId = Number(userId);
  if (!adminUserId) {
    return res.status(400).json({ message: "userId required" });
  }

  const emailNorm = normalizeEmail(email);
  const phoneStr = String(phone || "").trim();
  const passStr = String(password || "");
  const lastNameStr = String(lastName || "").trim();
  const firstNameStr = String(firstName || "").trim();
  const middleNameStr = String(middleName || "").trim() || null;
  const bd = parseBirthDate(birthDate);

  if (!isValidEmail(emailNorm)) {
    return res.status(400).json({ message: "Неверный формат email" });
  }

  if (!passStr || passStr.length < 4) {
    return res.status(400).json({ message: "Пароль минимум 4 символа" });
  }

  if (!isValidPhone(phoneStr)) {
    return res.status(400).json({ message: "Телефон должен быть 10–15 цифр (можно с +)" });
  }

  if (!bd) {
    return res.status(400).json({ message: "Неверная дата рождения" });
  }

  if (!isAtLeast16(bd)) {
    return res.status(400).json({ message: "Регистрация доступна только с 16 лет" });
  }

  if (!lastNameStr || !firstNameStr) {
    return res.status(400).json({ message: "Введите фамилию и имя" });
  }

  try {
    const ctx = await getAdminContext(adminUserId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

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

    const u = await query(
      `
      INSERT INTO public.users (role_id, login, password_hash, is_active, created_at)
      VALUES (2, $1, $2, true, now())
      RETURNING id
      `,
      [emailNorm, pwdHash]
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
        bd,
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

    res.json({
      clientId: newUserId,
      message: "Client created",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/admin/clients error:", e);
    res.status(500).json({ message: "Failed to create client" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  const adminUserId = getUserIdFromReq(req);
  const clientId = Number(req.params.id);
  const {
    lastName,
    firstName,
    middleName,
    phone,
    email,
    birthDate,
  } = req.body || {};

  if (!adminUserId || !clientId) {
    return res.status(400).json({ message: "userId and client id required" });
  }

  const emailNorm =
    email != null && String(email).trim() !== "" ? normalizeEmail(email) : null;

  if (emailNorm != null && !isValidEmail(emailNorm)) {
    return res.status(400).json({ message: "Неверный формат email" });
  }

  if (phone != null && String(phone).trim() !== "" && !isValidPhone(phone)) {
    return res.status(400).json({ message: "Неверный формат телефона" });
  }

  const bd =
    birthDate != null && String(birthDate).trim() !== ""
      ? parseBirthDate(birthDate)
      : null;

  if (birthDate != null && String(birthDate).trim() !== "" && !bd) {
    return res.status(400).json({ message: "Неверная дата рождения" });
  }

  try {
    const ctx = await getAdminContext(adminUserId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const scopeCheck = await query(
      `
      SELECT 1
      FROM public.bookings
      WHERE client_id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [clientId, ctx.club_id]
    );

    if (scopeCheck.rowCount === 0) {
      return res.status(404).json({ message: "Client not found in admin club scope" });
    }

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
        clientId,
        lastName != null ? String(lastName).trim() : null,
        firstName != null ? String(firstName).trim() : null,
        middleName != null ? (String(middleName).trim() || null) : null,
        phone != null ? String(phone).trim() : null,
        emailNorm,
        bd,
      ]
    );

    if (emailNorm != null) {
      await query(
        `
        UPDATE public.users
        SET login = $2
        WHERE id = $1
        `,
        [clientId, emailNorm]
      );
    }

    res.json({ message: "Client updated" });
  } catch (e) {
    console.error("PATCH /api/admin/clients/:id error:", e);
    res.status(500).json({ message: "Failed to update client" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  const adminUserId = getUserIdFromReq(req);
  const clientId = Number(req.params.id);

  if (!adminUserId || !clientId) {
    return res.status(400).json({ message: "userId and client id required" });
  }

  try {
    const ctx = await getAdminContext(adminUserId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const scopeCheck = await query(
      `
      SELECT 1
      FROM public.bookings
      WHERE client_id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [clientId, ctx.club_id]
    );

    if (scopeCheck.rowCount === 0) {
      return res.status(404).json({ message: "Client not found in admin club scope" });
    }

    await query("BEGIN");

    await query(
      `
      UPDATE public.bookings
      SET client_id = NULL
      WHERE client_id = $1
      `,
      [clientId]
    );

    await query(
      `
      UPDATE public.users
      SET client_id = NULL
      WHERE id = $1
      `,
      [clientId]
    );

    await query(`DELETE FROM public.clients WHERE id = $1`, [clientId]);
    await query(`DELETE FROM public.users WHERE id = $1`, [clientId]);

    await query("COMMIT");

    res.json({ message: "Client deleted" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("DELETE /api/admin/clients/:id error:", e);
    res.status(500).json({ message: "Failed to delete client" });
  }
});

// =========================
// TOURNAMENTS
// =========================
router.get("/tournaments", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT
        t.id,
        t.club_id,
        t.name,
        t.game,
        t.description,
        t.status_id,
        ts.code AS status_code,
        ts.name AS status_name,
        t.starts_at,
        t.ends_at,
        t.entry_fee,
        t.prize_pool,
        (
          SELECT COUNT(*)
          FROM public.tournament_teams tt
          WHERE tt.tournament_id = t.id
        ) AS teams_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', tm.id,
                'name', tm.name
              )
              ORDER BY tm.name
            )
            FROM public.tournament_teams tt
            JOIN public.teams tm ON tm.id = tt.team_id
            WHERE tt.tournament_id = t.id
          ),
          '[]'::json
        ) AS teams
      FROM public.tournaments t
      JOIN public.tournament_statuses ts ON ts.id = t.status_id
      WHERE t.club_id = $1
      ORDER BY t.starts_at DESC NULLS LAST, t.id DESC
      `,
      [ctx.club_id]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/tournaments error:", e);
    res.status(500).json({ message: "Failed to load tournaments" });
  }
});

router.post("/tournaments", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const {
    name,
    game,
    description,
    statusId,
    startsAt,
    endsAt,
    entryFee,
    prizePool,
    teamIds,
  } = req.body || {};

  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  if (!name && !statusId) {
    return res.status(400).json({ message: "Введите название турнира и выберите статус" });
  }

  if (!name) {
    return res.status(400).json({ message: "Введите название турнира" });
  }

  if (!statusId) {
    return res.status(400).json({ message: "Выберите статус турнира" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const normalizedTeamIds = Array.isArray(teamIds)
      ? [...new Set(teamIds.map((x) => Number(x)).filter(Boolean))]
      : [];

    if (normalizedTeamIds.length > 0) {
      const teamCheck = await query(
        `
        SELECT id
        FROM public.teams
        WHERE club_id = $1
          AND id = ANY($2::bigint[])
        `,
        [ctx.club_id, normalizedTeamIds]
      );

      if (teamCheck.rowCount !== normalizedTeamIds.length) {
        return res.status(400).json({ message: "Можно прикреплять только команды своего клуба" });
      }
    }

    const completedStatusIds = await resolveCompletedTournamentStatusIds();
    const nextStatusId = Number(statusId);

    if (
      completedStatusIds.includes(nextStatusId) &&
      isFutureDateTime(endsAt)
    ) {
      return res.status(400).json({
        message: "Нельзя установить статус «Завершён», если турнир ещё не начался или не закончился",
      });
    }

    await query("BEGIN");

    const r = await query(
      `
      INSERT INTO public.tournaments (
        club_id,
        name,
        game,
        description,
        status_id,
        starts_at,
        ends_at,
        entry_fee,
        prize_pool
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6::timestamptz, $7::timestamptz,
        $8::numeric, $9::numeric
      )
      RETURNING id
      `,
      [
        ctx.club_id,
        String(name).trim(),
        game ? String(game).trim() : null,
        description ? String(description).trim() : null,
        Number(statusId),
        startsAt ?? null,
        endsAt ?? null,
        entryFee ?? null,
        prizePool ?? null,
      ]
    );

    const tournamentId = Number(r.rows[0].id);

    for (const teamId of normalizedTeamIds) {
      await query(
        `
        INSERT INTO public.tournament_teams (tournament_id, team_id)
        VALUES ($1, $2)
        `,
        [tournamentId, teamId]
      );
    }

    await query("COMMIT");

    res.json({
      tournamentId,
      message: "Турнир создан",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/admin/tournaments error:", e);
    res.status(500).json({ message: "Failed to create tournament" });
  }
});

router.patch("/tournaments/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const tournamentId = Number(req.params.id);
  const {
    name,
    game,
    description,
    statusId,
    startsAt,
    endsAt,
    entryFee,
    prizePool,
    teamIds,
  } = req.body || {};

  if (!userId || !tournamentId) {
    return res.status(400).json({ message: "userId and tournament id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.tournaments
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [tournamentId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Tournament not found in admin club" });
    }

    const currentTournamentRes = await query(
      `
      SELECT id, status_id, starts_at, ends_at
      FROM public.tournaments
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [tournamentId, ctx.club_id]
    );

    const currentTournament = currentTournamentRes.rows[0];

    const completedStatusIds = await resolveCompletedTournamentStatusIds();

    const nextStatusId =
      statusId != null ? Number(statusId) : Number(currentTournament.status_id);

    const nextStartsAt =
      startsAt != null ? startsAt : currentTournament.starts_at;

    const nextEndsAt =
      endsAt != null ? endsAt : currentTournament.ends_at;

    if (
      completedStatusIds.includes(nextStatusId) &&
      isFutureDateTime(nextEndsAt)
    ) {
      return res.status(400).json({
        message: "Нельзя установить статус «Завершён», если турнир ещё не начался или не закончился",
      });
    }

    const normalizedTeamIds = Array.isArray(teamIds)
      ? [...new Set(teamIds.map((x) => Number(x)).filter(Boolean))]
      : [];

    if (normalizedTeamIds.length > 0) {
      const teamCheck = await query(
        `
        SELECT id
        FROM public.teams
        WHERE club_id = $1
          AND id = ANY($2::bigint[])
        `,
        [ctx.club_id, normalizedTeamIds]
      );

      if (teamCheck.rowCount !== normalizedTeamIds.length) {
        return res.status(400).json({ message: "Можно прикреплять только команды своего клуба" });
      }
    }

    await query("BEGIN");

    await query(
      `
      UPDATE public.tournaments
      SET
        name = COALESCE($2, name),
        game = COALESCE($3, game),
        description = COALESCE($4, description),
        status_id = COALESCE($5::smallint, status_id),
        starts_at = COALESCE($6::timestamptz, starts_at),
        ends_at = COALESCE($7::timestamptz, ends_at),
        entry_fee = COALESCE($8::numeric, entry_fee),
        prize_pool = COALESCE($9::numeric, prize_pool)
      WHERE id = $1
      `,
      [
        tournamentId,
        name != null ? String(name).trim() : null,
        game != null ? String(game).trim() : null,
        description != null ? String(description).trim() : null,
        statusId != null ? Number(statusId) : null,
        startsAt ?? null,
        endsAt ?? null,
        entryFee ?? null,
        prizePool ?? null,
      ]
    );

    await query(`DELETE FROM public.tournament_teams WHERE tournament_id = $1`, [tournamentId]);

    for (const teamId of normalizedTeamIds) {
      await query(
        `
        INSERT INTO public.tournament_teams (tournament_id, team_id)
        VALUES ($1, $2)
        `,
        [tournamentId, teamId]
      );
    }

    await query("COMMIT");

    res.json({ message: "Турнир обновлён" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("PATCH /api/admin/tournaments/:id error:", e);
    res.status(500).json({ message: "Failed to update tournament" });
  }
});

router.patch("/tournaments/:id/archive", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const tournamentId = Number(req.params.id);

  if (!userId || !tournamentId) {
    return res.status(400).json({ message: "userId and tournament id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.tournaments
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [tournamentId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Tournament not found in admin club" });
    }

    const archiveStatusId = await resolveTournamentArchiveStatusId();
    if (!archiveStatusId) {
      return res.status(400).json({ message: "Archive tournament status not found" });
    }

    await query(
      `
      UPDATE public.tournaments
      SET status_id = $2
      WHERE id = $1
      `,
      [tournamentId, archiveStatusId]
    );

    res.json({ message: "Tournament archived" });
  } catch (e) {
    console.error("PATCH /api/admin/tournaments/:id/archive error:", e);
    res.status(500).json({ message: "Failed to archive tournament" });
  }
});

router.delete("/tournaments/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const tournamentId = Number(req.params.id);

  if (!userId || !tournamentId) {
    return res.status(400).json({ message: "userId and tournament id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.tournaments
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [tournamentId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Tournament not found in admin club" });
    }

    await query("BEGIN");
    await query(`DELETE FROM public.tournament_teams WHERE tournament_id = $1`, [tournamentId]);
    await query(`DELETE FROM public.tournaments WHERE id = $1`, [tournamentId]);
    await query("COMMIT");

    res.json({ message: "Турнир удалён" });
  } catch (e) {
    await query("ROLLBACK");
    console.error("DELETE /api/admin/tournaments/:id error:", e);
    res.status(500).json({ message: "Failed to delete tournament" });
  }
});

// =========================
// SERVICE PRICES
// =========================
router.get("/service-prices", async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      SELECT
        sp.id,
        sp.service_id,
        s.name AS service_name,
        sp.club_id,
        sp.price_per_hour,
        sp.price_fixed,
        sp.currency,
        sp.is_active,
        sp.valid_from,
        sp.valid_to,
        sp.created_at
      FROM public.service_prices sp
      JOIN public.services s ON s.id = sp.service_id
      WHERE sp.club_id = $1
      ORDER BY s.name, sp.valid_from DESC, sp.id DESC
      `,
      [ctx.club_id]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/admin/service-prices error:", e);
    res.status(500).json({ message: "Failed to load service prices" });
  }
});

router.post("/service-prices", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const {
    serviceId,
    pricePerHour,
    priceFixed,
    currency,
    validFrom,
    validTo,
    isActive,
  } = req.body || {};

  if (!userId || !serviceId || !validFrom) {
    return res.status(400).json({ message: "userId, serviceId, validFrom required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const r = await query(
      `
      INSERT INTO public.service_prices (
        service_id,
        club_id,
        price_per_hour,
        price_fixed,
        currency,
        is_active,
        valid_from,
        valid_to,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3::numeric,
        $4::numeric,
        $5,
        $6,
        $7::date,
        $8::date,
        now()
      )
      RETURNING id
      `,
      [
        Number(serviceId),
        ctx.club_id,
        pricePerHour ?? null,
        priceFixed ?? null,
        currency ? String(currency).trim() : "RUB",
        isActive == null ? true : Boolean(isActive),
        validFrom,
        validTo ?? null,
      ]
    );

    res.json({
      servicePriceId: Number(r.rows[0].id),
      message: "Service price created",
    });
  } catch (e) {
    console.error("POST /api/admin/service-prices error:", e);
    res.status(500).json({ message: "Failed to create service price" });
  }
});

router.patch("/service-prices/:id", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const servicePriceId = Number(req.params.id);
  const {
    pricePerHour,
    priceFixed,
    currency,
    validFrom,
    validTo,
    isActive,
  } = req.body || {};

  if (!userId || !servicePriceId) {
    return res.status(400).json({ message: "userId and service price id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.service_prices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [servicePriceId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Service price not found in admin club" });
    }

    await query(
      `
      UPDATE public.service_prices
      SET
        price_per_hour = COALESCE($2::numeric, price_per_hour),
        price_fixed = COALESCE($3::numeric, price_fixed),
        currency = COALESCE($4, currency),
        is_active = COALESCE($5, is_active),
        valid_from = COALESCE($6::date, valid_from),
        valid_to = COALESCE($7::date, valid_to)
      WHERE id = $1
      `,
      [
        servicePriceId,
        pricePerHour ?? null,
        priceFixed ?? null,
        currency != null ? String(currency).trim() : null,
        isActive == null ? null : Boolean(isActive),
        validFrom ?? null,
        validTo ?? null,
      ]
    );

    res.json({ message: "Service price updated" });
  } catch (e) {
    console.error("PATCH /api/admin/service-prices/:id error:", e);
    res.status(500).json({ message: "Failed to update service price" });
  }
});

router.patch("/service-prices/:id/archive", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const servicePriceId = Number(req.params.id);

  if (!userId || !servicePriceId) {
    return res.status(400).json({ message: "userId and service price id required" });
  }

  try {
    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return res.status(403).json({ message: "Admin context not found" });
    }

    const check = await query(
      `
      SELECT 1
      FROM public.service_prices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [servicePriceId, ctx.club_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Service price not found in admin club" });
    }

    await query(
      `
      UPDATE public.service_prices
      SET
        is_active = FALSE,
        valid_to = COALESCE(valid_to, CURRENT_DATE)
      WHERE id = $1
      `,
      [servicePriceId]
    );

    res.json({ message: "Service price archived" });
  } catch (e) {
    console.error("PATCH /api/admin/service-prices/:id/archive error:", e);
    res.status(500).json({ message: "Failed to archive service price" });
  }
});

export default router;