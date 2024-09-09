import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = postgres(connectionString);

  console.log('Running seed.sql...');
  const seedSql = readFileSync(resolve(__dirname, 'seed.sql'), 'utf-8');
  await sql.unsafe(seedSql);

  console.log('Seed complete');
  await sql.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
