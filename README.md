# ⚙️QueueCTL
a CLI-based background job queue system called queuectl. This system should manage background jobs with worker processes, handle retries using exponential backoff, and maintain a Dead Letter Queue (DLQ) for permanently failed jobs.

## **Setup Instructions **

### 1. Clone the Repository
```bash
git  clone https://github.com/gauravkumar7294/QueueCTL.git
cd QueueCTL


# ** Run the Initial Database Migration (Crucial Step) **
1.npm run db:generate
2.npm run db:migrate
