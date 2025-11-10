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
