import { Router } from "express";
import { query } from "../db.js";

const router = Router();

/**
 * GET /api/services
 * Возвращает услуги + актуальную цену из service_prices
 * Можно передать ?clubId=...
 */
router.get("/", async (req, res) => {
  const clubIdRaw = req.query.clubId;
  const clubId = clubIdRaw ? Number(clubIdRaw) : null;

  try {
    const result = await query(
      `
      SELECT
        s.id,
        s.name,
        s.description,
        sp.price_per_hour,
        sp.price_fixed,
        sp.currency
      FROM public.services s
      LEFT JOIN LATERAL (
        SELECT
          sp2.price_per_hour,
          sp2.price_fixed,
          sp2.currency
        FROM public.service_prices sp2
        WHERE sp2.service_id = s.id
          AND sp2.is_active = TRUE
          AND sp2.valid_from <= CURRENT_DATE
          AND (sp2.valid_to IS NULL OR sp2.valid_to >= CURRENT_DATE)
          AND (
            $1::bigint IS NULL
            OR sp2.club_id = $1
            OR sp2.club_id IS NULL
          )
        ORDER BY
          (sp2.club_id IS NULL) ASC,
          sp2.valid_from DESC
        LIMIT 1
      ) sp ON TRUE
      ORDER BY s.name
      `,
      [clubId]
    );

    res.json({ items: result.rows });
  } catch (e) {
    console.error("GET /api/services error:", e);
    res.status(500).json({ message: "Failed to load services" });
  }
});

export default router;