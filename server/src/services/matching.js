import pool from '../utils/db.js';
import { rerankMatches } from './ai.js';

// Find matches for a lost or found item
export async function findMatches(item) {
  const isLost = item.type === 'lost';
  const oppositeType = isLost ? 'found' : 'lost';
  
  // Step 1: SQL shortlist - WHERE type='opposite' AND status='open', ranked by category, color, tag_overlap_count, created_at
  const shortlistQuery = `
    SELECT 
      id, type, title, description, category, color, brand, tags,
      location_name, lat, lng, happened_at, created_at
    FROM items
    WHERE 
      type = $1
      AND status = 'open'
      AND id != $2
    ORDER BY
      (category = $3) DESC,
      (color = $4) DESC,
      (SELECT COUNT(*) FROM (
        SELECT unnest(tags) INTERSECT SELECT unnest($5::text[])
      ) t) DESC,
      created_at DESC
    LIMIT 5
  `;
  
  const shortlistResult = await pool.query(shortlistQuery, [
    oppositeType,
    item.id,
    item.category || '',
    item.color || '',
    item.tags && item.tags.length > 0 ? item.tags : ['']
  ]);
  
  if (shortlistResult.rows.length === 0) {
    return [];
  }
  
  // Step 2: AI re-ranking
  let storedMatches = [];
  
  if (isLost) {
    // For lost item, rerank found candidates
    const aiRanked = await rerankMatches(item, shortlistResult.rows);
    storedMatches = aiRanked.map(m => ({
      lost_id: item.id,
      found_id: m.found_id,
      score: m.score,
      reason: m.reason
    }));
  } else {
    // For found item, check open lost items and store reverse matches
    // Each candidate is a lost item, item is the found item
    storedMatches = shortlistResult.rows.map(lostCandidate => {
      const lostTags = new Set(lostCandidate.tags || []);
      const foundTags = new Set(item.tags || []);
      const overlap = [...lostTags].filter(t => foundTags.has(t)).length;
      const sameCategory = lostCandidate.category === item.category;
      const score = Math.min(100, overlap * 20 + (sameCategory ? 20 : 0));

      return {
        lost_id: lostCandidate.id,
        found_id: item.id,
        score,
        reason: `${overlap} matching tags${sameCategory ? ', same category' : ''}`
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  // Store matches in database
  for (const match of storedMatches) {
    await pool.query(
      `INSERT INTO matches (lost_id, found_id, score, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lost_id, found_id) DO UPDATE
       SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
      [match.lost_id, match.found_id, match.score, match.reason]
    );
  }
  
  return storedMatches;
}

// Get stored matches for an item
export async function getMatches(itemId, itemType) {
  const isLost = itemType === 'lost';
  
  const query = `
    SELECT 
      m.id, m.score, m.reason, m.created_at,
      i.id as item_id, i.type, i.title, i.description, i.category, 
      i.color, i.brand, i.tags, i.location_name, i.happened_at, i.status,
      CASE WHEN i.type = 'lost' THEN i.image_url ELSE NULL END as image_url,
      CASE WHEN i.type = 'found' THEN (i.image_url IS NOT NULL) ELSE NULL END as has_image
    FROM matches m
    JOIN items i ON i.id = (CASE WHEN $2 = 'lost' THEN m.found_id ELSE m.lost_id END)
    WHERE (CASE WHEN $2 = 'lost' THEN m.lost_id ELSE m.found_id END) = $1
    ORDER BY m.score DESC, m.created_at DESC
  `;
  
  const result = await pool.query(query, [itemId, itemType]);
  return result.rows.map(row => {
    const sanitized = { ...row };
    if (sanitized.type === 'found') {
      delete sanitized.image_url;
      sanitized.has_image = sanitized.has_image === true;
    } else {
      delete sanitized.has_image;
    }
    return sanitized;
  });
}
