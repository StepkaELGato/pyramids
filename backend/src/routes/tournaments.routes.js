import { Router } from "express";
import { query } from "../db.js";

const router = Router();

/**
 * GET /api/tournaments/summary?clubId=123
 * Возвращает:
 * - tournaments: список турниров
 * - rating: рейтинг команд
 */
router.get("/summary", async (req, res) => {
  const clubIdRaw = req.query.clubId;
  const clubId = clubIdRaw ? Number(clubIdRaw) : null;

  try {
    // 1) турниры
    const tournamentsRes = await query(
      `
      SELECT
        tr.id,
        tr.club_id,
        c.city,
        c.address,
        tr.name,
        tr.game,
        tr.description,
        tr.status_id,
        ts.code AS status_code,
        ts.name AS status_name,
        tr.starts_at,
        tr.ends_at,
        tr.entry_fee,
        tr.prize_pool,
        (
          SELECT COUNT(*)
          FROM public.tournament_teams tt
          WHERE tt.tournament_id = tr.id
        ) AS teams_count
      FROM public.tournaments tr
      JOIN public.tournament_statuses ts ON ts.id = tr.status_id
      JOIN public.clubs c ON c.id = tr.club_id
      WHERE ($1::bigint IS NULL OR tr.club_id = $1)
      ORDER BY tr.starts_at NULLS LAST, tr.id ASC
      `,
      [clubId]
    );

    // 2) рейтинг команд
    const ratingRes = await query(
      `
      SELECT
        te.id,
        te.name,
        COUNT(tt.tournament_id)::int AS participations,
        (1500 + COUNT(tt.tournament_id) * 80)::int AS points
      FROM public.teams te
      JOIN public.tournament_teams tt ON tt.team_id = te.id
      JOIN public.tournaments tr ON tr.id = tt.tournament_id
      WHERE ($1::bigint IS NULL OR tr.club_id = $1)
      GROUP BY te.id, te.name
      ORDER BY points DESC, te.name ASC
      LIMIT 10
      `,
      [clubId]
    );

    res.json({
      tournaments: tournamentsRes.rows,
      rating: ratingRes.rows,
    });
  } catch (e) {
    console.error("GET /api/tournaments/summary error:", e);
    res.status(500).json({ message: "Failed to load tournaments summary" });
  }
});

export default router;