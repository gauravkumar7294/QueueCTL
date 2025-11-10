import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';
import { config, jobs } from './schema.js'; 
import chalk from 'chalk';

console.log(chalk.magenta('Running migrations..'));

const dbPath = path.join(process.cwd(), 'jobs.db');
const sqlite = new Database(dbPath);

const migratorDb = drizzle(sqlite);
migrate(migratorDb, { migrationsFolder: './drizzle' });
console.log(chalk.green('Migrations applied successfully. '));


const seedDb = drizzle(sqlite, { schema: { config, jobs } }); 

console.log(chalk.yellow('Seeding default configuration...'));
try {
  seedDb.insert(config)
    .values([
      { key: 'max_retries', value: '3' },
      { key: 'backoff_base', value: '2' },
    ])
    .onConflictDoNothing()
    .run();
  console.log(chalk.blue('Default config seeded. '));
} catch (err) {
  console.error(chalk.red('Error seeding config:', err.message));
}

sqlite.close();