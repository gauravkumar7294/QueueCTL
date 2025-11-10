const Database=require('better-sqlite3');
const path=require('path');

const dbPath=path.join(process.cwd(),'jobs.db');
const db=new Database(dbPath);


function initDb(){
    const createTableSql=`
     CREATE TABLE IF NOT EXISTS jobs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      backoff_base INTEGER NOT NULL DEFAULT 2,
      run_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      created_At INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      output TEXT
     );`
    ;

    db.exec(createTableSql);

    db.exec('PRAGMA journal_node=WAL;');
    db.exec('PRAGMA synchronous=NORMAL;');
}

initDb();
module.exports=db;