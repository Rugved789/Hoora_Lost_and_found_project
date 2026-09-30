import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import pool from '../utils/db.js';
import { uploadImage } from '../services/cloudinary.js';
import { tagImage, generateQuestions } from '../services/ai.js';
import { findMatches, getMatches } from '../services/matching.js';
import { getLockoutStatus } from '../services/claimsHelper.js';

const router = express.Router();

// Multer config - memory storage (5MB max, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files allowed', 400, 'INVALID_FILE_TYPE'));
    } else {
      cb(null, true);
    }
  }
});

// AI endpoint rate limit (10/min per user or IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-user-id'] || req.user?.id?.toString() || req.ip,
  message: { error: 'Too many AI requests', code: 'AI_RATE_LIMIT' }
});

// Validation schemas
const CreateItemSchema = z.object({
  type: z.enum(['lost', 'found']),
  description: z.string().optional(),
  location_name: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  happened_at: z.string()
});

// POST /api/items - Create new item [auth]
router.post('/', requireUser, aiLimiter, upload.single('image'), asyncHandler(async (req, res) => {
  const data = CreateItemSchema.parse(req.body);
  
  if (!req.file && data.type === 'found') {
    throw new AppError('Found items must include an image', 400, 'IMAGE_REQUIRED');
  }
  
  let imageUrl = null;
  let aiTags = null;
  
  // Upload image and get AI tags
  if (req.file) {
    imageUrl = await uploadImage(req.file.buffer);
    aiTags = await tagImage(req.file.buffer, req.file.mimetype, data.description);
  } else {
    // Lost item without image - use description fallback
    aiTags = {
      title: data.description ? data.description.split('\n')[0].slice(0, 50) : 'Lost Item',
      category: 'other',
      color: 'unknown',
      brand: 'unknown',
      tags: data.description ? data.description.toLowerCase().split(/\s+/).filter(w => w.length > 2) : [],
      description: data.description || '',
      hidden_details: {
        distinguishing_features: [],
        contents: [],
        marks: [],
        condition: 'unknown'
      }
    };
  }
  
  // Insert item
  const insertQuery = `
    INSERT INTO items (
      type, title, description, image_url, category, color, brand, tags,
      location_name, lat, lng, happened_at, status, hidden_details, poster_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `;
  
  const result = await pool.query(insertQuery, [
    data.type,
    aiTags.title,
    aiTags.description || data.description,
    imageUrl,
    aiTags.category,
    aiTags.color,
    aiTags.brand,
    aiTags.tags,
    data.location_name,
    data.lat,
    data.lng,
    data.happened_at,
    'open',
    JSON.stringify(aiTags.hidden_details),
    req.user.id
  ]);
  
  const item = result.rows[0];
  
  // Find matches (if lost, find found; if found, find lost)
  const matches = await findMatches(item);
  
  // Return item plus matches
  res.status(201).json({
    item,
    matches
  });
}));

// GET /api/items - Public feed
router.get('/', asyncHandler(async (req, res) => {
  const { type, status, category, q, location } = req.query;
  
  let query = `
    SELECT 
      i.id, i.type, i.title, i.description, i.category, i.color, i.brand, i.tags,
      i.location_name, i.lat, i.lng, i.happened_at, i.status, i.created_at,
      CASE WHEN i.type = 'lost' THEN i.image_url ELSE NULL END as image_url,
      CASE WHEN i.type = 'found' THEN (i.image_url IS NOT NULL) ELSE NULL END as has_image
    FROM items i
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;
  
  if (type) {
    paramCount++;
    query += ` AND i.type = $${paramCount}`;
    params.push(type);
  }
  
  if (status) {
    paramCount++;
    query += ` AND i.status = $${paramCount}`;
    params.push(status);
  }
  
  if (category) {
    paramCount++;
    query += ` AND i.category = $${paramCount}`;
    params.push(category);
  }
  
  if (location) {
    paramCount++;
    query += ` AND i.location_name ILIKE $${paramCount}`;
    params.push(`%${location}%`);
  }
  
  if (q) {
    paramCount++;
    query += ` AND (
      i.title ILIKE $${paramCount} OR 
      i.description ILIKE $${paramCount} OR
      EXISTS (SELECT 1 FROM unnest(i.tags) tag WHERE tag ILIKE $${paramCount})
    )`;
    params.push(`%${q}%`);
  }
  
  query += ` ORDER BY i.created_at DESC LIMIT 100`;
  
  const result = await pool.query(query, params);
  
  // NEVER return hidden_details or a found item's image_url
  const items = result.rows.map(row => {
    const sanitized = { ...row };
    delete sanitized.hidden_details;
    
    if (sanitized.type === 'found') {
      delete sanitized.image_url;
      sanitized.has_image = sanitized.has_image === true;
    } else {
      delete sanitized.has_image;
    }
    
    return sanitized;
  });
  
  res.json({ items });
}));

// GET /api/items/:id - Public item detail (same public projection)
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    `SELECT 
      id, type, title, description, category, color, brand, tags,
      location_name, lat, lng, happened_at, status, created_at,
      CASE WHEN type = 'lost' THEN image_url ELSE NULL END as image_url,
      CASE WHEN type = 'found' THEN (image_url IS NOT NULL) ELSE NULL END as has_image
    FROM items WHERE id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('Item not found', 404, 'NOT_FOUND');
  }
  
  const item = { ...result.rows[0] };
  delete item.hidden_details;
  
  if (item.type === 'found') {
    delete item.image_url;
    item.has_image = item.has_image === true;
  } else {
    delete item.has_image;
  }
  
  res.json({ item });
}));

// GET /api/items/:id/matches - Get matches (owner only)
router.get('/:id/matches', requireUser, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const itemResult = await pool.query(
    'SELECT type, poster_id FROM items WHERE id = $1',
    [id]
  );
  
  if (itemResult.rows.length === 0) {
    throw new AppError('Item not found', 404, 'NOT_FOUND');
  }
  
  const item = itemResult.rows[0];
  
  // Ownership rules: only poster of lost item (or admin) can view its matches
  if (item.poster_id !== req.user.id && !req.user.is_admin) {
    throw new AppError('Not authorized to view matches', 403, 'FORBIDDEN');
  }
  
  const matches = await getMatches(parseInt(id), item.type);
  
  res.json({ matches });
}));

// POST /api/items/:id/claim/start [auth] - start claim verification
router.post('/:id/claim/start', requireUser, aiLimiter, asyncHandler(async (req, res) => {
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
  
  // A user cannot claim their own posted item
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
  
  // Create claim (never return expected answers)
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

// PATCH /api/items/:id/status - Update status [auth] (transactional row lock)
router.patch('/:id/status', requireUser, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['open', 'at_desk', 'claimed', 'returned'].includes(status)) {
    throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Row lock on item
    const itemResult = await client.query(
      'SELECT id, type, status, poster_id FROM items WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (itemResult.rows.length === 0) {
      throw new AppError('Item not found', 404, 'NOT_FOUND');
    }
    
    const item = itemResult.rows[0];
    
    // Ownership rules: only the finder or an admin can change a found item's status
    if (item.poster_id !== req.user.id && !req.user.is_admin) {
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    }
    
    // Validate status transitions: open -> at_desk -> claimed -> returned
    const currentStatus = item.status;
    const validTransitions = {
      'open': ['at_desk'],
      'at_desk': ['claimed'],
      'claimed': ['returned']
    };
    
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new AppError(
        `Cannot transition from ${currentStatus} to ${status}`,
        400,
        'INVALID_TRANSITION'
      );
    }
    
    // Update status. Karma is NOT awarded here per requirement 3.
    await client.query(
      'UPDATE items SET status = $1 WHERE id = $2',
      [status, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, status });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/items/:id/confirm-received - Owner confirms receipt [auth]
// Awards +10 karma once per item (idempotent, guarded in transaction with karma_awarded flag)
router.post('/:id/confirm-received', requireUser, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      'SELECT id, type, status, poster_id, karma_awarded FROM items WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (itemResult.rows.length === 0) {
      throw new AppError('Item not found', 404, 'NOT_FOUND');
    }

    const item = itemResult.rows[0];
    let finderId = null;
    let isOwner = false;

    if (item.type === 'found') {
      // For a found item, the owner is the claimant who passed claim verification
      const claimResult = await client.query(
        'SELECT claimant_id FROM claims WHERE item_id = $1 AND passed = true',
        [id]
      );

      if (claimResult.rows.length === 0) {
        throw new AppError('No verified claimant found for this item', 400, 'NO_VERIFIED_OWNER');
      }

      if (claimResult.rows[0].claimant_id === req.user.id) {
        isOwner = true;
      }
      finderId = item.poster_id;
    } else if (item.type === 'lost') {
      // For a lost item, the owner is the poster
      if (item.poster_id === req.user.id) {
        isOwner = true;
      }

      // Finder is the poster of the matching found item
      const matchResult = await client.query(
        `SELECT f.poster_id 
         FROM matches m 
         JOIN items f ON f.id = m.found_id 
         WHERE m.lost_id = $1 
         ORDER BY m.score DESC 
         LIMIT 1`,
        [id]
      );

      if (matchResult.rows.length > 0) {
        finderId = matchResult.rows[0].poster_id;
      }
    }

    if (!isOwner) {
      throw new AppError('Only the verified owner can confirm receipt', 403, 'FORBIDDEN');
    }

    // Idempotent karma award
    let karmaGiven = false;
    if (!item.karma_awarded) {
      if (finderId && finderId !== req.user.id) {
        await client.query(
          'UPDATE users SET karma = karma + 10 WHERE id = $1',
          [finderId]
        );
        karmaGiven = true;
      }

      await client.query(
        "UPDATE items SET status = 'returned', karma_awarded = true WHERE id = $1",
        [id]
      );
    } else if (item.status !== 'returned') {
      await client.query(
        "UPDATE items SET status = 'returned' WHERE id = $1",
        [id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: karmaGiven ? 'Receipt confirmed and karma awarded to finder' : 'Receipt confirmed',
      status: 'returned',
      karma_awarded: true
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

export default router;
