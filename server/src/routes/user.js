import express from 'express';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import pool from '../utils/db.js';

const router = express.Router();

// GET /api/me - Current user profile
router.get('/me', requireUser, asyncHandler(async (req, res) => {
  // Get user with karma
  const userResult = await pool.query(
    'SELECT id, name, email, karma, is_admin FROM users WHERE id = $1',
    [req.user.id]
  );
  
  // Get user's posts
  const postsResult = await pool.query(
    `SELECT id, type, title, description, category, status, location_name, happened_at, created_at
     FROM items
     WHERE poster_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  
  // Get user's claims
  const claimsResult = await pool.query(
    `SELECT 
       c.id, c.score, c.passed, c.attempts, c.created_at,
       i.id as item_id, i.title, i.description, i.category, i.status
     FROM claims c
     JOIN items i ON i.id = c.item_id
     WHERE c.claimant_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  
  res.json({
    user: userResult.rows[0],
    posts: postsResult.rows,
    claims: claimsResult.rows
  });
}));

export default router;
