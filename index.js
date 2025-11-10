#!/usr/bin/env node

import { Command } from 'commander';
import { enqueueJob, listJobs, listDlqJobs, retryDlqJob, showStatus } from './src/queue.js';
import { WorkerManager, stopWorker } from './src/worker.js';
import { setConfig, listConfig } from './src/config.js';

const program = new Command();

program
  .name('queuectl')
  .description('A CLI-based background job queue system');

program
  .command('enqueue <json>')
  .description('Add a new job to the queue (e.g., \'{"id":"job1", "command":"sleep 2"}\')')
  .action(enqueueJob);

// --- Worker Commands ---
const worker = program.command('worker')
  .description('Manage worker processes');

worker
  .command('start')
  .description('Start one or more workers')
  .option('--count <n>', 'Number of concurrent workers', '1')
  .action((options) => {
    const manager = new WorkerManager(parseInt(options.count, 10));
    manager.start();
  });

worker
  .command('stop')
  .description('Stop running workers gracefully')
  .action(stopWorker); // this is async in nature

// --- Status Command ---
program
  .command('status')
  .description('Show summary of all job states & active workers')
  .action(showStatus); // this is async in nature

// --- List Command ---
program
  .command('list')
  .description('List jobs by state')
  .option('--state <state>', 'Filter by state (e.g., pending, processing)')
  .action(listJobs);

// --- DLQ Commands ---
const dlq = program.command('dlq')
  .description('View or retry DLQ jobs');

dlq
  .command('list')
  .description('View all jobs in the Dead Letter Queue')
  .action(listDlqJobs);

dlq
  .command('retry <job_id>')
  .description('Retry a specific job from the DLQ')
  .action(retryDlqJob);

// --- Config Commands ---
const config = program.command('config')
  .description('Manage configuration (retry, backoff, etc.)');

config
  .command('list')
  .description('List all current configurations')
  .action(listConfig);

config
  .command('set <key> <value>')
  .description('Set a configuration value (e.g., max-retries 3)')
  .action(setConfig);

// Handle unknown commands
program.on('command:*', () => {
  console.error('Invalid command: %s\n', program.args.join(' '));
  program.help();
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);