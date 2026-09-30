-- Drop tables if they exist
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  clerk_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  karma INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items table
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  color TEXT,
  brand TEXT,
  tags TEXT[] DEFAULT '{}',
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  happened_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'at_desk', 'claimed', 'returned')),
  hidden_details JSONB,
  poster_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  karma_awarded BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Claims table
CREATE TABLE claims (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  answers JSONB,
  score INTEGER,
  passed BOOLEAN,
  attempts INTEGER DEFAULT 0,
  last_failed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_id, claimant_id)
);

-- Matches table
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  lost_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lost_id, found_id)
);

-- Indexes
CREATE INDEX idx_items_type_status ON items(type, status);
CREATE INDEX idx_items_tags ON items USING GIN(tags);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_happened_at ON items(happened_at DESC);
CREATE INDEX idx_matches_lost_id ON matches(lost_id);
CREATE INDEX idx_matches_found_id ON matches(found_id);
CREATE INDEX idx_claims_item_id ON claims(item_id);
CREATE INDEX idx_claims_claimant_id ON claims(claimant_id);
