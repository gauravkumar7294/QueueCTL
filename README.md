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

## CLI Commands

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

