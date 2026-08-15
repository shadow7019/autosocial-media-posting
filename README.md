# Social Media Automation Agent

A full-stack social media automation agent built with Next.js, Prisma, and a local background daemon.

## Project Structure

- `app/`: Next.js App Router (Dashboard UI and API Routes).
- `daemon/`: Background Node.js process that watches a local folder.
- `lib/`: Shared utilities (Prisma client, Trend Analysis).
- `prisma/`: Database schema and migrations.

## Getting Started

### 1. Prerequisites
- Node.js installed.
- A PostgreSQL database (or use the default SQLite for local dev).

### 2. Installation
```bash
cd social-media-agent
npm install
cd daemon
npm install
```

### 3. Database Setup
Ensure your `DATABASE_URL` is set in the root `.env` file.
```bash
# In the root directory
npx prisma db push
```

### 4. Running the Application

**Start the Web Dashboard:**
```bash
npm run dev
```

**Start the Local Daemon:**
```bash
cd daemon
node watcher.js
```

## How it Works
1. **Detection:** Drop a video file (.mp4, .mov, etc.) into `daemon/uploads/`.
2. **Scheduling:** The daemon reports the file to the Next.js API. The API analyzes trends (mocked for now) and schedules the post.
3. **Upload:** The daemon polls the API for due uploads and executes them (mocked upload logic).

## Configuration
- `DAEMON_SECRET`: Shared secret between the daemon and API for security.
- `WATCH_DIR`: The local folder to monitor for new videos.
- `POLL_INTERVAL`: How often the daemon checks for scheduled uploads.

## Note on Prisma 7
During development, we encountered some configuration strictness with Prisma 7 and Next.js Turbopack. We've optimized the setup, but ensure your database connection is stable for the best experience.
