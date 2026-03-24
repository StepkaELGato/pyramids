import { Router } from "express";
import { query } from "../db.js";

const router = Router();

/**
 * GET /api/clubs/cities
 * Список городов, где есть клубы
 */
router.get("/cities", async (req, res) => {
  try {
    const r = await query(
      `
      SELECT DISTINCT c.city
      FROM public.clubs c
      WHERE c.city IS NOT NULL
        AND btrim(c.city) <> ''
      ORDER BY c.city
      `
    );

    res.json({
      items: r.rows.map((row) => row.city),
    });
  } catch (e) {
    console.error("GET /api/clubs/cities error:", e);
    res.status(500).json({ message: "Failed to load cities" });
  }
});

/**
 * GET /api/clubs?city=Москва
 * Список клубов, можно фильтровать по городу
 */
router.get("/", async (req, res) => {
  const city = String(req.query.city || "").trim();

  try {
    let r;

    if (city) {
      r = await query(
        `
        SELECT
          c.id,
          c.name,
          c.city,
          c.address,
          c.phone,
          c.work_hours,
          c.created_at,
          c.latitude,
          c.longitude
        FROM public.clubs c
        WHERE c.city = $1
        ORDER BY c.name
        `,
        [city]
      );
    } else {
      r = await query(
        `
        SELECT
          c.id,
          c.name,
          c.city,
          c.address,
          c.phone,
          c.work_hours,
          c.created_at,
          c.latitude,
          c.longitude
        FROM public.clubs c
        ORDER BY c.city, c.name
        `
      );
    }

    res.json({ items: r.rows });
  } catch (e) {
    console.error("GET /api/clubs error:", e);
    res.status(500).json({ message: "Failed to load clubs" });
  }
});

export default router;