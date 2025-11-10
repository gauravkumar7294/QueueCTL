import { db, betterSqliteDriver } from './db/index.js'; 
import { jobs } from './db/schema.js';
import { getConfig } from './config.js';
import { eq, lte, asc, and } from 'drizzle-orm';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import path from 'path';
import fs from 'fs';
import find from 'find-process';

const exec = promisify(execCallback);
const pidFilePath = path.join(process.cwd(), '.queuectl.pid');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export async function stopWorker() {
  const pid = getWorkerPid();
  if (!pid) {
    console.log('Worker is not running.');
    return;
  }
  const isRunning = await isProcessRunning(pid);
  if (!isRunning) {
    console.log('Worker is not running (stale PID file found). Cleaning up.');
    cleanupPidFile();
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent stop signal to worker (PID: ${pid}).`);
  } catch (err) {
    console.error(`Failed to stop worker (PID: ${pid}): ${err.message}`);
    if (err.code === 'ESRCH') {
      cleanupPidFile();
    }
  }
}
export async function getWorkerStatus() {
  const pid = getWorkerPid();
  if (!pid) {
    return 'Stopped';
  }
  const isRunning = await isProcessRunning(pid);
  if (isRunning) {
    return `Running (PID: ${pid})`;
  } else {
    return 'Stopped (Stale PID file found)';
  }
}

export class WorkerManager {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.isShuttingDown = false;
    this.workers = [];
    this.config = {};
  }

  async start() {
    const pid = getWorkerPid();
    if (pid && (await isProcessRunning(pid))) {
      console.error(`Error: Worker process is already running (PID: ${pid}).`);
      return;
    }
    fs.writeFileSync(pidFilePath, process.pid.toString());
    this.config = getConfig();
    console.log(`Starting ${this.concurrency} workers... (Press CTRL+C to stop)`);
    console.log(`Config loaded: max_retries=${this.config.max_retries}, backoff_base=${this.config.backoff_base}`);
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(this.runWorker(i));
    }
  }
  shutdown() {
    if (this.isShuttingDown) return;
    console.log('\nGracefully shutting down... (Finishing current jobs)');
    this.isShuttingDown = true;
    Promise.all(this.workers).then(() => {
      console.log('All workers stopped.');
      cleanupPidFile();
      betterSqliteDriver.close();
      process.exit(0);
    });
  }

  async runWorker(workerId) {
    console.log(`Worker ${workerId} started.`);
    while (!this.isShuttingDown) {
      const job = this.fetchJob(workerId);
      if (job) {
        await this.processJob(workerId, job);
      } else {
        await sleep(1000);
      }
    }
    console.log(`Worker ${workerId} stopped.`);
  }


  fetchJob(workerId) {
    const now = Math.floor(Date.now() / 1000);
    try {
      
      const job = betterSqliteDriver.transaction(() => {
        
        const jobToTake = db.select().from(jobs)
          .where(and(
            eq(jobs.state, 'pending'),
            lte(jobs.run_at, now)
          ))
          .orderBy(asc(jobs.created_at))
          .limit(1)
          .get(); 

        if (!jobToTake) {
          return null;
        }

       
        db.update(jobs)
          .set({ state: 'processing', run_at: now })
          .where(eq(jobs.id, jobToTake.id))
          .run(); 
        
       
        return jobToTake;
      })(); 

      if (job) {
        
        job.state = 'processing'; 
        console.log(`[Worker ${workerId}] Picked up job ${job.id}`);
      }
      return job;
    } catch (err) {
      console.error(`[Worker ${workerId}] Error fetching job:`, err.message);
      return null;
    }
  }


  async processJob(workerId, job) {
    console.log(`[Worker ${workerId}] Executing job ${job.id}: ${job.command}`);
    try {
      const { stdout, stderr } = await exec(job.command);
      const output = (stdout || '') + (stderr || '');
      this.markCompleted(job, output);
      console.log(`[Worker ${workerId}] ✅ Completed job ${job.id}`);
    } catch (error) {
      console.error(`[Worker ${workerId}] ❌ Failed job ${job.id}: ${error.message}`);
      this.handleFailure(job, error.stderr || error.message);
    }
  }
  markCompleted(job, output) {
    db.update(jobs)
      .set({ state: 'completed', output: output || '' })
      .where(eq(jobs.id, job.id))
      .run();
  }
  handleFailure(job, errorOutput) {
    const newAttempts = job.attempts + 1;
    const maxRetries = parseInt(this.config.max_retries || '3', 10);
    const backoffBase = parseInt(this.config.backoff_base || '2', 10);
    if (newAttempts >= maxRetries) {
      console.log(`Job ${job.id} exhausted retries, moving to DLQ.`);
      db.update(jobs)
        .set({ state: 'dead', output: errorOutput })
        .where(eq(jobs.id, job.id))
        .run();
    } else {
      const delayInSeconds = Math.pow(backoffBase, newAttempts);
      const newRunAt = Math.floor(Date.now() / 1000) + delayInSeconds;
      console.log(`Job ${job.id} will retry in ${delayInSeconds}s (Attempt ${newAttempts})`);
      db.update(jobs)
        .set({
          state: 'pending',
          attempts: newAttempts,
          run_at: newRunAt,
          output: errorOutput
        })
        .where(eq(jobs.id, job.id))
        .run();
    }
  }
}

function getWorkerPid() {
  try {
    if (fs.existsSync(pidFilePath)) {
      const pid = fs.readFileSync(pidFilePath, 'utf-8');
      return parseInt(pid, 10);
    }
  } catch (err) {
    return null;
  }
  return null;
}
async function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    const list = await find('pid', pid);
    return list.length > 0;
  } catch (err) {
    return false;
  }
}
function cleanupPidFile() {
  try {
    if (fs.existsSync(pidFilePath)) {
      fs.unlinkSync(pidFilePath);
    }
  } catch (err) {
    console.error('Error cleaning up PID file:', err.message);
  }
}