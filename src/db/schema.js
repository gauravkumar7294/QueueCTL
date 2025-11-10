import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
import {sql} from "drizzle-orm";
import crypto from 'crypto';


const now=()=>sql`(strftime('%s','now'))`;

export const jobs=sqliteTable('jobs',{
    id:text('id').primaryKey().$defaultFn(()=>crypto.randomUUID()),

    command:text('command').notNull(),
    state:text('state').notNull().default('pending'),
    attempts:integer('attempts').notNull().default(0),

    max_retries:integer('max_retries').notNull().default(3),
    backoff_base:integer('backoff_base').notNull().default(2),
    run_at:integer('run_at').notNull().default(now()),
    
    created_at:integer('created_at').notNull().default(now()),
    updated_at:integer('updated_at').notNull().default(now()).$onUpdate(()=>now()),
    output:text('output'),
});

export const config=sqliteTable('config',{
    key:text('key').primaryKey(),
    value:text('value'),
});