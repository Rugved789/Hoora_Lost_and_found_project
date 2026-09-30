import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import pool from '../utils/db.js';

const router = express.Router();

// GET /api/stats/hotspots - Lost item hotspots
router.get('/hotspots', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT 
      location_name,
      COUNT(*)::int as count,
      AVG(lat)::float as lat,
      AVG(lng)::float as lng
    FROM items
    WHERE type = 'lost' AND status = 'open'
    GROUP BY location_name
    HAVING COUNT(*) > 0
    ORDER BY count DESC
  `);
  
  res.json({ hotspots: result.rows });
}));

// GET /api/leaderboard and /api/stats/leaderboard - Top users by karma (name and karma only)
export const getLeaderboardHandler = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT name, COALESCE(karma, 0)::int as karma
    FROM users
    ORDER BY karma DESC, name ASC
    LIMIT 10
  `);
  
  res.json({ leaderboard: result.rows });
});

router.get('/leaderboard', getLeaderboardHandler);

export default router;
