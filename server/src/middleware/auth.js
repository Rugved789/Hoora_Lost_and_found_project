import { clerkClient, getAuth } from '@clerk/express';
import pool from '../utils/db.js';
import { AppError } from '../utils/errors.js';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_MODE = process.env.AUTH_MODE || 'clerk';
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || '';

// Main authentication middleware
export const requireUser = async (req, res, next) => {
  try {
    const authMode = process.env.AUTH_MODE || 'clerk';
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || '';

    // 1. Mock mode for curl tests and leak test
    if (authMode === 'mock') {
      const mockUserId = req.headers['x-user-id'] || '1';
      
      const result = await pool.query(
        'SELECT id, clerk_id, name, email, is_admin FROM users WHERE id = $1',
        [mockUserId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found in mock mode', 401, 'UNAUTHENTICATED');
      }

      req.user = result.rows[0];
      return next();
    }

    // 2. Clerk mode
    const { userId } = getAuth(req);

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    // 3. Look up users by clerk_id
    let result = await pool.query(
      'SELECT id, clerk_id, name, email, is_admin FROM users WHERE clerk_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Fetch details from Clerk
      const clerkUser = await clerkClient.users.getUser(userId);
      const userEmail = clerkUser.emailAddresses?.[0]?.emailAddress || '';
      const userName = clerkUser.firstName && clerkUser.lastName 
        ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
        : clerkUser.username || userEmail.split('@')[0] || 'User';

      // Check allowed email domain if configured
      if (allowedDomain && !userEmail.endsWith(allowedDomain)) {
        throw new AppError(
          `Email domain not allowed. Only ${allowedDomain} is accepted.`,
          403,
          'DOMAIN_NOT_ALLOWED'
        );
      }

      // Upsert into users
      result = await pool.query(
        `INSERT INTO users (clerk_id, name, email, karma, is_admin)
         VALUES ($1, $2, $3, 0, false)
         ON CONFLICT (clerk_id) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email
         RETURNING id, clerk_id, name, email, is_admin`,
        [userId, userName, userEmail]
      );
    }

    // 4. Attach req.user = {id, clerk_id, name, email, is_admin}
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.isOperational) {
      next(error);
    } else {
      console.error('Auth error:', error);
      next(new AppError('Authentication failed', 401, 'UNAUTHENTICATED'));
    }
  }
};
