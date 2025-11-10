import {drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import * as schema from './schema.js';

const dbPath=path.join(process.cwd(),'jobs.db');
const sqlite=new Database(dbPath);

sqlite.exec('PRAGMA journal_mode=WAL;');
sqlite.exec('PRAGMA synchronous=NORMAL;');

export const db=drizzle(sqlite,{schema});
export {sqlite as betterSqliteDriver};