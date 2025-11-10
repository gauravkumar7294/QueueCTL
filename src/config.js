import { db } from './db/index.js';
import { config } from './db/schema.js';
import { eq, sql } from 'drizzle-orm';

export function setConfig(key, value) {
  try {
    db.insert(config)
      .values({ key, value })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: sql`excluded.value` },
      })
      .run();
    console.log(`Config updated: ${key} = ${value}`);
  } catch (err) {
    console.error('Error setting config:', err.message);
  }
}


export function getConfig() {
  try {
    const rows = db.select().from(config).all();
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  } catch (err) {
    console.error('Error getting config:', err.message);
    return {};
  }
}


export function listConfig() {
  const allConfig = getConfig();
  if (Object.keys(allConfig).length === 0) {
    console.log('No configuration set.');
    return;
  }
  console.table(allConfig);
}