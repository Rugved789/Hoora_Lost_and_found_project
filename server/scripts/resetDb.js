import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

async function resetDatabase() {
  const requiresSsl = process.env.DATABASE_URL?.includes('neon.tech') || 
                      process.env.DATABASE_URL?.includes('sslmode=require');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Resetting database...');

    // Read and execute schema
    const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    console.log('✅ Schema created');

    // Read and execute seed
    const seed = readFileSync(join(__dirname, '../db/seed.sql'), 'utf-8');
    await pool.query(seed);
    console.log('✅ Database seeded');

    console.log('🎉 Database reset complete!');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
