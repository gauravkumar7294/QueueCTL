# ⚙️QueueCTL
a CLI-based background job queue system called queuectl. This system should manage background jobs with worker processes, handle retries using exponential backoff, and maintain a Dead Letter Queue (DLQ) for permanently failed jobs.

### Prerequisites
```bash
Node.js (v18 or later)
npm
```

## Setup Instructions 

### 1. Clone the Repository
```bash
git  clone https://github.com/gauravkumar7294/QueueCTL.git
cd QueueCTL
```

### 2. Install the Dependencies
```bash
npm install
```

### 3. Run the Initial Database Migration (Crucial Step) 
```bash
   npm run db:generate
   npm run db:migrate
```

### 4. Link the CLI Tool
```bash
npm link
```

## 💻 CLI Commands

Here is a quick reference for all available commands.

| Category | Command | Description |
| :--- | :--- | :--- |
| Config | `queuectl config list` | List all current configurations. |
| Config | `queuectl config set <key> <value>` | Set a configuration value (e.g., `max-retries 5`). |
| Enqueue | `queuectl enqueue <json_string>` | Add a new job to the queue (e.g., `"{\"cmd\":...}"`). |
| Workers | `queuectl worker start --count <n>` | Start worker processes (default count is 1). |
| Workers | `queuectl worker stop` | Stop running workers gracefully. |
| Status | `queuectl status` | Show summary of all job states & active workers. |
| List Jobs | `queuectl list --state <state>` | List jobs by state (e.g., `pending`, `processing`). |
| DLQ | `queuectl dlq list` | View all jobs in the Dead Letter Queue. |
| DLQ | `queuectl dlq retry <job_id>` | Retry a specific job from the DLQ. |

---

### Usage Examples

Here are examples of the commands in action with their expected outputs.

#### ⚙️ Config Commands

**`queuectl config list`**
```bash
$ queuectl config list
┌──────────────┬────────┐
│   (index)    │ Values │
├──────────────┼────────┤
│ max_retries  │ '3'    │
│ backoff_base │ '2'    │
└──────────────┴────────┘
```
## 🏛️ Architecture Overview

`queuectl` is designed around a central, persistent **SQLite database (`jobs.db`)** that acts as the single source of truth. This makes the system durable and portable.

### 💾 Data Persistence

The `jobs.db` file contains two simple tables:

* **`jobs` table:** Stores all jobs, including their `id`, `command`, `state` (`pending`, `processing`, `completed`, `dead`), `attempts`, and `run_at` time for scheduled retries.
* **`config` table:** A key-value store for global settings like `max_retries` and `backoff_base`.

### 👷 Worker Logic & Job Lifecycle

The worker is the engine of the system, built for reliability.



1.  **Polling:** Workers constantly poll the `jobs` table for `pending` jobs that are ready to run (i.e., `run_at <= now()`).
2.  **Atomic Locking:** To prevent two workers from grabbing the same job (a "race condition"), the worker uses a **synchronous database transaction**. This transaction atomically finds a `pending` job and updates its `state` to `processing` in one indivisible operation.
3.  **Execution:** The worker executes the job's `command`.
    * **Success (Exit Code 0):** The job's state is set to `completed`.
    * **Failure (Non-zero Exit Code):** The worker increments the `attempts` count.
4.  **Retry or DLQ:**
    * If `attempts < max_retries`, the job's `state` is set back to `pending` and its `run_at` time is updated using an **exponential backoff** formula.
    * If `attempts >= max_retries`, the job's `state` is set to `dead` and it's moved to the Dead Letter Queue (DLQ).
5.  **Graceful Shutdown:** The worker listens for `SIGTERM` (from `worker stop`) and `SIGINT` (Ctrl+C). It will finish its current job before exiting cleanly, ensuring no work is lost.

## 💡 Assumptions & Trade-offs

This project was built with simplicity and reliability in mind, which led to several key design decisions.

* **SQLite vs. a Dedicated Broker (like Redis or RabbitMQ):**
    * **Decision:** We chose `better-sqlite3` (a file-based database) over a dedicated in-memory store.
    * **Pro:** Zero setup, single-file persistence (`jobs.db`), and true durability. The queue survives restarts with no data loss.
    * **Con:** Not designed for the hyper-high throughput (thousands of jobs/sec) of a dedicated broker.

* **Synchronous Driver (`better-sqlite3`):**
    * **Decision:** We used a synchronous (blocking) SQLite driver in Node.js.
    * **Pro:** This massively simplifies the most critical, complex part of the system: the **atomic "fetch-and-lock" transaction**. This prevents race conditions and is far easier to reason about than an async equivalent.
    * **Con:** It blocks the Node.js event loop during database queries. This is an acceptable trade-off for a background worker that is not handling high-traffic web requests.

* **Global Configuration:**
    * **Decision:** Settings like `max_retries` are stored in a global `config` table, not on each job.
    * **Pro:** Allows changing the retry policy for the *entire system* on the fly with one command (`queuectl config set max_retries 5`).
    * **Con:** You cannot have different retry policies for different *types* of jobs (e.g., a "high-priority" job with 10 retries vs. a "low-priority" one with 2).

* **PID File for Worker Management:**
    * **Decision:** A `.queuectl.pid` file is used to manage the worker process.
    * **Pro:** A very simple, OS-level way for `worker stop` to find and signal the `worker start` process without complex Inter-Process Communication (IPC).
    * **Con:** If the worker is hard-killed (e.g., `kill -9`), the `.queuectl.pid` file can become "stale." The `status` command is built to detect and report this state.



## ✅ Testing Instructions

Follow this end-to-end test plan to verify all core functionality is working correctly.

**Pre-requisite:** You must have run `npm run db:migrate` and `npm link`.

### Test 1: Config System

This test verifies the `config` table was seeded and is writable.

1.  **Check defaults:**
    ```bash
    $ queuectl config list
    # Expected: Shows defaults (max_retries: 3, backoff_base: 2)
    ```
2.  **Set a low retry count for fast testing:**
    ```bash
    $ queuectl config set max_retries 2
    Config updated: max_retries = 2
    ```

### Test 2: Job Success & Worker Status

This test requires **two terminals** open in your project directory.

**In Terminal 1:**
1.  **Start the worker:**
    ```bash
    $ queuectl worker start
    # Expected: Worker starts and loads config (max_retries=2)
    ```

**In Terminal 2:**
1.  **Enqueue a job that will succeed:**
    ```bash
    # (Use "..." for Windows-safe JSON)
    $ queuectl enqueue "{\"command\":\"echo 'test success'\"}"
    ✅ Job enqueued...
    ```
2.  **Check status:**
    ```bash
    $ queuectl status
    # Expected: Worker Status: Running (PID: ...)
    ```

**In Terminal 1 (Watch the worker):**
* **Expected:** The worker logs `Picked up job...`, `Executing job...`, and `✅ Completed job...`.

### Test 3: Job Failure & DLQ

Keep the worker running in **Terminal 1**.

**In Terminal 2:**
1.  **Enqueue a job that will fail:**
    ```bash
    $ queuectl enqueue "{\"id\":\"job-fail\", \"command\":\"exit 1\"}"
    ✅ Job enqueued...
    ```

**In Terminal 1 (Watch the worker):**
* **Expected:** The worker will:
    1.  Log `❌ Failed job ...`
    2.  Log `Job job-fail will retry in 2s (Attempt 1)`
    3.  Log `❌ Failed job ...`
    4.  Log `Job job-fail exhausted retries, moving to DLQ.`

**In Terminal 2:**
1.  **Check the Dead Letter Queue:**
    ```bash
    $ queuectl dlq list
    # Expected: Shows 'job-fail' in the DLQ table.
    ```

### Test 4: DLQ Retry

Keep the worker running in **Terminal 1**.

**In Terminal 2:**
1.  **Retry the failed job:**
    ```bash
    $ queuectl dlq retry job-fail
    ✅ Job job-fail has been moved from DLQ to 'pending' state.
    ```

**In Terminal 1 (Watch the worker):**
* **Expected:** The worker will immediately pick up `job-fail` again and repeat the entire failure process (Test 3), moving it back to the DLQ.

### Test 5: Worker Stop

1.  **In Terminal 2:**
    ```bash
    $ queuectl worker stop
    Sent stop signal to worker (PID: ...)
    ```

2.  **In Terminal 1:**
    * **Expected:** The worker logs `Gracefully shutting down...` and the process exits.

3.  **In Terminal 2:**
    ```bash
    $ queuectl status
    # Expected: Worker Status: Stopped
    ```
