import { db } from './db/index.js';
import { jobs } from './db/schema.js';
import { eq, ne, asc, and, sql } from 'drizzle-orm';
import { getWorkerStatus } from './worker.js';
import chalk from 'chalk'

export function enqueueJob(jsonString) {
  try {
    const { id, command } = JSON.parse(jsonString);

    if (!command) {
      console.error(chalk.red('Error: The "command" field is required in the JSON string.'));
      return;
    }

    const newJob = { command };
    if (id) {
      newJob.id = id;
    }

    const result = db.insert(jobs).values(newJob).run();
    const insertedId = id || result.lastInsertRowid; 
    
    console.log(`✅ Job enqueued (ID: ${insertedId}): ${command}`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Error: Invalid JSON string.', err.message);
    } else {
      console.error('Error enqueuing job:', err.message);
    }
  }
}

export function listJobs(options) {
  try {
    const { state } = options;
    
    let query = db.select({
        id: jobs.id,
        state: jobs.state,
        attempts: jobs.attempts,
        command: jobs.command,
        run_at: jobs.run_at
      })
      .from(jobs);

 
    const conditions = [ne(jobs.state, 'dead')]; 
    if (state) {
      conditions.push(eq(jobs.state, state));
    }

    const rows = query.where(and(...conditions)).orderBy(asc(jobs.created_at)).all(); 
    
    if (rows.length === 0) {
      console.log('No active jobs matching criteria.');
      return;
    }
    
    console.table(rows.map(job => ({
      ...job,
      run_at: new Date(job.run_at * 1000).toISOString()
    })));
  } catch (err) {
    console.error('Error listing jobs:', err.message);
  }
}


export function listDlqJobs() {
  try {
    const rows = db.select({
        id: jobs.id,
        state: jobs.state,
        command: jobs.command,
        output: jobs.output,
        updated_at: jobs.updated_at
      })
      .from(jobs)
      .where(eq(jobs.state, 'dead'))
      .orderBy(asc(jobs.created_at))
      .all();

    if (rows.length === 0) {
      console.log('No jobs in DLQ.');
      return;
    }

    console.log('--- 💀 Dead Letter Queue 💀 ---');
    console.table(rows.map(job => ({
      ...job,
      updated_at: new Date(job.updated_at * 1000).toISOString()
    })));
  } catch (err) {
    console.error('Error listing DLQ jobs:', err.message);
  }
}


export function retryDlqJob(jobId) {
  try {
    const job = db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.state, 'dead')))
      .get();

    if (!job) {
      console.error(`Error: Job ${jobId} not found in the Dead Letter Queue.`);
      return;
    }

   
    db.update(jobs)
      .set({
        state: 'pending',
        attempts: 0,
        run_at: Math.floor(Date.now() / 1000), 
        output: 'Retrying from DLQ...'
      })
      .where(eq(jobs.id, jobId))
      .run();
    
    console.log(`✅ Job ${jobId} has been moved from DLQ to 'pending' state.`);
  } catch (err) {
    console.error('Error retrying job:', err.message);
  }
}


export async function showStatus() {
  try {
    const rows = db.select({
        state: jobs.state,
        count: sql`COUNT(*)`
      })
      .from(jobs)
      .groupBy(jobs.state)
      .all();

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0
    };
    rows.forEach(row => {
      counts[row.state] = row.count;
    });

    console.log('--- 📊 Job Status ---');
    console.table(counts);

    
    const workerStatus = await getWorkerStatus();
    console.log('\n--- 👷 Worker Status ---');
    console.log(workerStatus);

  } catch (err) {
    console.error('Error getting status:', err.message);
  }
}