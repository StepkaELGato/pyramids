import { Router } from "express";
import { query } from "../db.js";

const router = Router();

/**
 * Валидации для гостя
 */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
}

function isValidPhone(phone) {
  if (!phone) return false;
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

/**
 * Временный разбор ФИО гостя из одной строки.
 * Формат:
 * - "Иванов Иван Иванович" -> { lastName, firstName, middleName }
 * - "Иванов Иван" -> { lastName, firstName, middleName: null }
 */
function splitGuestName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    return {
      lastName: null,
      firstName: null,
      middleName: null,
    };
  }

  return {
    lastName: parts[0] || null,
    firstName: parts[1] || null,
    middleName: parts[2] || null,
  };
}

/**
 * Берём актуальную цену услуги для клуба на конкретную дату.
 */
async function getServicePrice({ serviceId, clubId, onDate }) {
  const r = await query(
    `
    SELECT
      sp.price_per_hour,
      sp.price_fixed,
      sp.currency
    FROM public.service_prices sp
    WHERE sp.service_id = $1
      AND sp.is_active = TRUE
      AND sp.valid_from <= $3::date
      AND (sp.valid_to IS NULL OR sp.valid_to >= $3::date)
      AND (sp.club_id = $2 OR sp.club_id IS NULL)
    ORDER BY (sp.club_id IS NULL) ASC, sp.valid_from DESC
    LIMIT 1
    `,
    [serviceId, clubId, onDate]
  );

  return r.rowCount ? r.rows[0] : null;
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

function isVipRoomService(serviceName) {
  const name = String(serviceName || "").toLowerCase();
  return name.includes("vip");
}

function hoursBetween(startISO, endISO) {
  const a = new Date(startISO);
  const b = new Date(endISO);
  const ms = b.getTime() - a.getTime();
  return ms / 3600000;
}

function toDateOnlyISO(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function getDayBounds(dateYYYYMMDD) {
  const [y, m, d] = String(dateYYYYMMDD).split("-").map(Number);

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  return { start, end };
}


/** Проверяем, что device принадлежит клубу */
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

/**
 * Проверяем, что device принадлежит клубу
 */
async function assertDeviceInClub({ deviceId, clubId }) {
  const r = await query(
    `
    SELECT 1
    FROM public.devices d
    WHERE d.id = $1 AND d.club_id = $2
    LIMIT 1
    `,
    [deviceId, clubId]
  );

  return r.rowCount > 0;
}

/**
 * GET /api/booking/meta?clubId=1
 * Возвращает места для схемы
 */
router.get("/meta", async (req, res) => {
  const clubId = Number(req.query.clubId);
  if (!clubId) {
    return res.status(400).json({ message: "clubId is required" });
  }

  try {
    const devices = await query(
      `
      SELECT
        d.id,
        d.code,
        d.status_id,
        dt.code AS type_code,
        dt.name AS type_name
      FROM public.devices d
      JOIN public.device_types dt ON dt.id = d.type_id
      WHERE d.club_id = $1
      ORDER BY dt.id, d.id
      `,
      [clubId]
    );

    res.json({ devices: devices.rows });
  } catch (e) {
    console.error("GET /api/booking/meta error:", e);
    res.status(500).json({ message: "Failed to load booking meta" });
  }
});

/**
 * GET /api/booking/availability?clubId=1&start=...&end=...
 * Возвращает занятые device_id на интервале
 */
router.get("/availability", async (req, res) => {
  const clubId = Number(req.query.clubId);
  const start = req.query.start;
  const end = req.query.end;

  if (!clubId || !start || !end) {
    return res.status(400).json({ message: "clubId, start, end are required" });
  }

  try {
    const busy = await query(
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

    res.json({ busyDeviceIds: busy.rows.map((r) => Number(r.device_id)) });
  } catch (e) {
    console.error("GET /api/booking/availability error:", e);
    res.status(500).json({ message: "Failed to load availability" });
  }
});

/**
 * GET /api/bookings?clientId=123
 * Возвращает брони клиента + коды устройств
 */
router.get("/", async (req, res) => {
  const clientId = Number(req.query.clientId);
  if (!clientId) {
    return res.status(400).json({ message: "clientId is required" });
  }

  try {
    const r = await query(
      `
      SELECT
        b.id,
        b.club_id,
        c.name AS club_name,
        c.city AS club_city,
        c.address AS club_address,
        b.status_id,
        b.service_id,
        b.start_time,
        b.end_time,
        b.comment,
        b.total_price,
        b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'code', d.code,
              'type_code', dt.code,
              'type_name', dt.name
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS devices
      FROM public.bookings b
      JOIN public.clubs c ON c.id = b.club_id
      LEFT JOIN public.booking_devices bd ON bd.booking_id = b.id
      LEFT JOIN public.devices d ON d.id = bd.device_id
      LEFT JOIN public.device_types dt ON dt.id = d.type_id
      WHERE b.client_id = $1
      GROUP BY b.id, c.name, c.city, c.address
      ORDER BY b.start_time DESC
      LIMIT 100
      `,
      [clientId]
    );

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/bookings error:", e);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

/**
 * POST /api/bookings
 * body:
 * {
 *   clubId, serviceId,
 *   startTime, endTime,
 *   deviceIds: [..]   // бронируем только 1 место
 *   clientId: number|null,
 *   guestName, guestPhone, guestEmail,
 *   comment
 * }
 */
router.post("/", async (req, res) => {
  const {
    clubId,
    serviceId,
    startTime,
    endTime,
    deviceIds,
    clientId,
    guestName,
    guestPhone,
    guestEmail,
    comment,
  } = req.body || {};

  if (!clubId || !serviceId || !startTime || !endTime || !Array.isArray(deviceIds)) {
    return res.status(400).json({
      message: "clubId, serviceId, startTime, endTime, deviceIds are required",
    });
  }

  const service = await getServiceInfo(Number(serviceId));
  if (!service) {
    return res.status(400).json({ message: "Service not found" });
  }

  const isWholeDayBooking = isWholeClubDayService(service.name);
  const isVipRoomBooking = isVipRoomService(service.name);
  const noDeviceRequired = isWholeDayBooking || isVipRoomBooking;

  let deviceId = null;

  if (!noDeviceRequired) {
    if (deviceIds.length !== 1) {
      return res.status(400).json({ message: "Нужно выбрать ровно 1 место" });
    }

    deviceId = Number(deviceIds[0]);
    if (!deviceId) {
      return res.status(400).json({ message: "Invalid deviceId" });
    }
  }

  let guestLastName = null;
  let guestFirstName = null;
  let guestMiddleName = null;

  if (clientId == null) {
    if (!guestName || !guestPhone || !guestEmail) {
      return res.status(400).json({
        message: "guestName, guestPhone, guestEmail are required for guest booking",
      });
    }

    if (!isValidPhone(guestPhone)) {
      return res.status(400).json({ message: "Неверный формат телефона гостя" });
    }

    if (!isValidEmail(guestEmail)) {
      return res.status(400).json({ message: "Неверный формат email гостя" });
    }

    const split = splitGuestName(guestName);
    guestLastName = split.lastName;
    guestFirstName = split.firstName;
    guestMiddleName = split.middleName;

    if (!guestLastName || !guestFirstName || !guestMiddleName) {
      return res.status(400).json({
        message: "Для гостя нужно указать фамилию, имя и отчество",
      });
    }
  }

  const hrs = hoursBetween(startTime, endTime);
  if (!Number.isFinite(hrs) || hrs <= 0) {
    return res.status(400).json({ message: "Invalid time range" });
  }

  const onDate = toDateOnlyISO(startTime);
  if (!onDate) {
    return res.status(400).json({ message: "Invalid startTime" });
  }

  try {
    await query("BEGIN");

    const clubRes = await query(
      `
      SELECT work_hours
      FROM public.clubs
      WHERE id = $1
      LIMIT 1
      `,
      [Number(clubId)]
    );

    if (clubRes.rowCount === 0) {
      await query("ROLLBACK");
      return res.status(404).json({ message: "Клуб не найден" });
    }

    const clubWorkHours = clubRes.rows[0].work_hours || null;

    if (!noDeviceRequired) {
      const workHoursCheck = isBookingInsideWorkHours(startTime, endTime, clubWorkHours);
      if (!workHoursCheck.ok) {
        await query("ROLLBACK");
        return res.status(400).json({ message: workHoursCheck.message });
      }
    }

    if (!noDeviceRequired) {
      const okDevice = await assertDeviceInClub({ deviceId, clubId });
      if (!okDevice) {
        await query("ROLLBACK");
        return res.status(400).json({ message: "Выбранное место не принадлежит этому клубу" });
      }
    }

    const price = await getServicePrice({ serviceId, clubId, onDate });
    if (!price) {
      await query("ROLLBACK");
      return res.status(400).json({ message: "Price not found for selected service" });
    }

    const perHour = price.price_per_hour != null ? Number(price.price_per_hour) : 0;
    const fixed = price.price_fixed != null ? Number(price.price_fixed) : 0;
    const total = Math.round((perHour * hrs + fixed) * 100) / 100;

    if (isWholeDayBooking) {
      const dayStart = new Date(startTime);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const conflict = await query(
        `
        SELECT 1
        FROM public.bookings b
        WHERE b.club_id = $1
          AND tstzrange(b.start_time, b.end_time, '[)') &&
              tstzrange($2::timestamptz, $3::timestamptz, '[)')
        LIMIT 1
        `,
        [clubId, dayStart.toISOString(), dayEnd.toISOString()]
      );

      if (conflict.rowCount > 0) {
        await query("ROLLBACK");
        return res.status(409).json({
          message: "На эту дату уже есть бронирования клуба. Бронирование клуба на весь день недоступно.",
        });
      }
    }

    if (!noDeviceRequired) {
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
        [clubId, startTime, endTime]
      );

      if (wholeDayConflict.rowCount > 0) {
        await query("ROLLBACK");
        return res.status(409).json({
          message: "Клуб уже забронирован на весь день на эту дату.",
        });
      }
    }

    if (!noDeviceRequired) {
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
        [clubId, deviceId, startTime, endTime]
      );

      if (conflict.rowCount > 0) {
        await query("ROLLBACK");
        return res.status(409).json({ message: "Выбранное место уже занято на это время" });
      }
    }

    if (conflict.rowCount > 0) {
      await query("ROLLBACK");
      return res.status(409).json({ message: "Выбранное место уже занято на это время" });
    }

    const bookingIns = await query(
      `
      INSERT INTO public.bookings
        (
          club_id,
          client_id,
          guest_last_name,
          guest_first_name,
          guest_middle_name,
          guest_phone,
          guest_email,
          status_id,
          service_id,
          start_time,
          end_time,
          comment,
          total_price
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          1,
          $8,
          $9::timestamptz,
          $10::timestamptz,
          $11,
          $12::numeric
        )
      RETURNING id
      `,
      [
        Number(clubId),
        clientId != null ? Number(clientId) : null,
        guestLastName,
        guestFirstName,
        guestMiddleName,
        clientId == null ? String(guestPhone).trim() : null,
        clientId == null ? String(guestEmail).trim().toLowerCase() : null,
        Number(serviceId),
        startTime,
        endTime,
        comment ?? null,
        total,
      ]
    );

    const bookingId = Number(bookingIns.rows[0].id);

    if (!noDeviceRequired) {
      await query(
        `
        INSERT INTO public.booking_devices (booking_id, device_id, start_time, end_time)
        VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
        `,
        [bookingId, deviceId, startTime, endTime]
      );
    }

    await query("COMMIT");

    res.json({
      bookingId,
      totalPrice: total,
      message: "Бронь создана!",
    });
  } catch (e) {
    await query("ROLLBACK");
    console.error("POST /api/bookings error:", e);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

export default router;