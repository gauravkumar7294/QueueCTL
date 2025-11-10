# ⚙️QueueCTL
a CLI-based background job queue system called queuectl. This system should manage background jobs with worker processes, handle retries using exponential backoff, and maintain a Dead Letter Queue (DLQ) for permanently failed jobs.

### Prerequisites
Node.js (v18 or later)
npm

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
# 1.Generate the migration SQL (creates the 'drizzle' folder)
   npm run db:generate
# 2.Run the migration and seed the database
   npm run db:migrate
```

### 4. Link the CLI Tool
```bash
npm link
```
