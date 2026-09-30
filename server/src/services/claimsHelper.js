import pool from '../utils/db.js';

/**
 * Checks lockout status across ALL claim rows for a (claimant_id, item_id) pair.
 * After 3 failed attempts, locks for 24 hours from the most recent failed attempt.
 */
export async function getLockoutStatus(claimantId, itemId, dbClient = pool) {
  const result = await dbClient.query(
    `SELECT 
       COALESCE(SUM(attempts), 0)::int as total_attempts,
       MAX(last_failed_at) as last_failed_at,
       BOOL_OR(passed) as has_passed
     FROM claims
     WHERE claimant_id = $1 AND item_id = $2`,
    [claimantId, itemId]
  );
  
  const stats = result.rows[0];
  const totalAttempts = stats?.total_attempts || 0;
  const lastFailedAt = stats?.last_failed_at;
  const hasPassed = Boolean(stats?.has_passed);

  if (totalAttempts >= 3) {
    const lastFailedTime = lastFailedAt ? new Date(lastFailedAt).getTime() : Date.now();
    const lockoutExpiresAt = lastFailedTime + 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (now < lockoutExpiresAt) {
      const retryAfterSeconds = Math.max(1, Math.ceil((lockoutExpiresAt - now) / 1000));
      return {
        locked: true,
        retryAfter: retryAfterSeconds,
        totalAttempts,
        hasPassed
      };
    }
  }

  return {
    locked: false,
    retryAfter: 0,
    totalAttempts,
    hasPassed
  };
}
