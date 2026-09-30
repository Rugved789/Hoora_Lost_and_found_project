import pg from 'pg';

const { Client } = pg;

async function setup() {
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'rugved',
    database: 'postgres'
  });

  try {
    await client.connect();
    const res = await client.query("SELECT datname FROM pg_database WHERE datname = 'backtoyou'");
    if (res.rows.length === 0) {
      await client.query("CREATE DATABASE backtoyou");
      console.log("✅ Created database 'backtoyou'");
    } else {
      console.log("Database 'backtoyou' already exists.");
    }
  } catch (err) {
    console.error('Setup error:', err.message);
  } finally {
    await client.end();
  }
}

setup();
