import express from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import pool from '../utils/db.js';
import { generateQuestions, scoreAnswers } from '../services/ai.js';
import { getLockoutStatus } from '../services/claimsHelper.js';

const router = express.Router();

// AI endpoint rate limit
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-user-id'] || req.user?.id?.toString() || req.ip,
  message: { error: 'Too many AI requests', code: 'AI_RATE_LIMIT' }
});

// POST /api/claims/items/:id/claim/start - Start a claim (also mounted under /api/items/:id/claim/start)
router.post('/items/:id/claim/start', requireUser, aiLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Get the found item
  const itemResult = await pool.query(
    'SELECT id, type, status, hidden_details, poster_id FROM items WHERE id = $1',
    [id]
  );
  
  if (itemResult.rows.length === 0) {
    throw new AppError('Item not found', 404, 'NOT_FOUND');
  }
  
  const item = itemResult.rows[0];
  
  if (item.type !== 'found') {
    throw new AppError('Can only claim found items', 400, 'INVALID_ITEM_TYPE');
  }
  
  if (item.status !== 'open' && item.status !== 'at_desk') {
    throw new AppError('Item is not available for claiming', 400, 'ITEM_NOT_AVAILABLE');
  }
  
  // Cannot claim own item
  if (item.poster_id === req.user.id) {
    throw new AppError('Cannot claim your own item', 400, 'CANNOT_CLAIM_OWN_ITEM');
  }

  // 1. Attempt lockout: check across ALL claim rows for this (claimant, item)
  const lockout = await getLockoutStatus(req.user.id, item.id);
  if (lockout.locked) {
    throw new AppError('Too many failed attempts. Locked for 24 hours.', 403, 'LOCKED', { retry_after: lockout.retryAfter });
  }

  if (lockout.hasPassed) {
    throw new AppError('You have already successfully claimed this item', 400, 'ALREADY_CLAIMED');
  }
  
  // 2. Stable questions: reuse existing active claim and its stored questions
  const existingClaim = await pool.query(
    `SELECT id, attempts, passed, questions 
     FROM claims 
     WHERE item_id = $1 AND claimant_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [id, req.user.id]
  );
  
  if (existingClaim.rows.length > 0) {
    const claim = existingClaim.rows[0];
    return res.json({
      claim_id: claim.id,
      questions: claim.questions,
      attempts_left: Math.max(0, 3 - lockout.totalAttempts)
    });
  }
  
  // Generate 3 verification questions from hidden_details
  const questions = await generateQuestions(item.hidden_details || {});
  
  // Create new claim
  const claimResult = await pool.query(
    `INSERT INTO claims (item_id, claimant_id, questions, attempts)
     VALUES ($1, $2, $3, 0)
     RETURNING id`,
    [id, req.user.id, JSON.stringify(questions)]
  );
  
  res.json({
    claim_id: claimResult.rows[0].id,
    questions,
    attempts_left: Math.max(0, 3 - lockout.totalAttempts)
  });
}));

// POST /api/claims/:id/answer - Submit answers (transactional row lock)
router.post('/:id/answer', requireUser, aiLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const AnswerSchema = z.object({
    answers: z.array(z.string()).length(3)
  });
  
  const { answers } = AnswerSchema.parse(req.body);
  
  // Get claim and check lockout before AI scoring
  const claimResult = await pool.query(
    `SELECT c.*, i.hidden_details, i.poster_id, i.status as item_status
     FROM claims c
     JOIN items i ON i.id = c.item_id
     WHERE c.id = $1 AND c.claimant_id = $2`,
    [id, req.user.id]
  );
  
  if (claimResult.rows.length === 0) {
    throw new AppError('Claim not found', 404, 'NOT_FOUND');
  }
  
  const claim = claimResult.rows[0];
  
  if (claim.passed) {
    throw new AppError('Claim already passed', 400, 'ALREADY_PASSED');
  }

  const preLockout = await getLockoutStatus(req.user.id, claim.item_id);
  if (preLockout.locked) {
    throw new AppError('Too many failed attempts. Locked for 24 hours.', 403, 'LOCKED', { retry_after: preLockout.retryAfter });
  }
  
  // Score answers with AI / fallback
  const result = await scoreAnswers(claim.questions, answers, claim.hidden_details);
  
  // DB Transaction with row locks (FOR UPDATE OF c, i)
  const client = await pool.connect();
  let finderInfo = null;
  let attemptsLeft = 0;

  try {
    await client.query('BEGIN');

    // Row lock on claim and item
    const lockRes = await client.query(
      `SELECT c.id, c.passed, c.item_id, i.poster_id, i.status as item_status
       FROM claims c
       JOIN items i ON i.id = c.item_id
       WHERE c.id = $1 AND c.claimant_id = $2
       FOR UPDATE OF c, i`,
      [id, req.user.id]
    );

    if (lockRes.rows.length === 0) {
      throw new AppError('Claim not found', 404, 'NOT_FOUND');
    }

    const lockedClaim = lockRes.rows[0];
    if (lockedClaim.passed) {
      throw new AppError('Claim already passed', 400, 'ALREADY_PASSED');
    }

    const lockout = await getLockoutStatus(req.user.id, lockedClaim.item_id, client);
    if (lockout.locked) {
      throw new AppError('Too many failed attempts. Locked for 24 hours.', 403, 'LOCKED', { retry_after: lockout.retryAfter });
    }

    if (result.passed) {
      await client.query(
        `UPDATE claims 
         SET answers = $1, score = $2, passed = true, attempts = attempts + 1
         WHERE id = $3`,
        [JSON.stringify(answers), result.score, id]
      );

      await client.query(
        "UPDATE items SET status = 'claimed' WHERE id = $1",
        [lockedClaim.item_id]
      );

      const finderRes = await client.query(
        'SELECT name, email FROM users WHERE id = $1',
        [lockedClaim.poster_id]
      );
      finderInfo = finderRes.rows[0];
      attemptsLeft = Math.max(0, 3 - (lockout.totalAttempts + 1));
    } else {
      await client.query(
        `UPDATE claims 
         SET answers = $1, score = $2, passed = false, attempts = attempts + 1, last_failed_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(answers), result.score, id]
      );
      attemptsLeft = Math.max(0, 3 - (lockout.totalAttempts + 1));
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  res.json({
    score: result.score,
    passed: result.passed,
    attempts_left: attemptsLeft,
    details: result.per_question,
    finder: finderInfo
  });
}));

export default router;
