# AutoSocial — Social Media Automation Agent

A production-ready, AI-powered social media automation agent. Drop a video into the
watched folder (or upload via the dashboard) and AutoSocial will:

1. **Detect** the new video via the background daemon.
2. **Analyze trends** with an LLM to pick the optimal posting time.
3. **Generate** a catchy title, caption, and hashtags with AI.
4. **Schedule** the post and execute the upload at the right moment.
5. **Stream real-time progress** to the dashboard over WebSocket.

Built with **Next.js 16**, **Prisma**, **socket.io**, **shadcn/ui**, and the
**z-ai-web-dev-sdk** LLM.

---

## ✨ Features

- **Single-page dashboard** with 5 views: Dashboard, Posts, Schedule, Analytics, Settings
- **Drag-and-drop upload** with live progress bar (XHR-powered)
- **AI trend analysis** — picks optimal posting time with human-readable reasoning
- **AI caption generation** — generates title, caption, and hashtags automatically
- **Real-time updates** over socket.io (post detection, upload progress, status changes)
- **Folder watcher daemon** — drop a file, it gets scheduled automatically
- **Analytics** with 4 live charts (area / donut / bar / bar)
- **Dark / light mode**, fully responsive, sticky footer
- **Activity audit log** of every action
- **Platform management** (YouTube, TikTok, Instagram, X)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (single-page app at /)                              │
│  React 19 + shadcn/ui + TanStack Query + Zustand            │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTP (REST)                  │ WebSocket
                ▼                              ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│  Next.js 16 API (port 3000)  │  │  Daemon mini-service       │
│  - posts CRUD + upload       │  │  (port 3003, socket.io)    │
│  - stats / analytics         │  │  - folder watcher (chokidar)│
│  - settings / platforms      │  │  - cron poll for due posts │
│  - AI caption / trends       │  │  - simulated upload + prog  │
│  - daemon poll endpoint      │  │  - real-time event emitter │
└───────────────┬──────────────┘  └────────────┬───────────────┘
                │                                │
                ▼                                ▼
        ┌──────────────────────────────────────────┐
        │  Prisma + SQLite                         │
        │  User · Post · ActivityLog · Setting ·   │
        │  Platform                                │
        └──────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh)
- A working `DATABASE_URL` (SQLite by default)

### Install
```bash
bun install
cd mini-services/autosocial-daemon && bun install && cd ../..
```

### Configure
```bash
cp .env.example .env
# Edit .env and set a strong DAEMON_SECRET
```

### Database
```bash
bun run db:push
```

### Run
```bash
# Terminal 1 — Next.js web app (port 3000)
bun run dev

# Terminal 2 — daemon mini-service (port 3003)
bash mini-services/autosocial-daemon/start.sh
```

Then open <http://localhost:3000>.

> The daemon is auto-restarted by `start.sh` if it ever crashes.

## 📂 Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # Single-page app shell (only visible route)
│   │   ├── layout.tsx            # Root layout + providers
│   │   └── api/                  # 12 REST routes
│   ├── components/               # shadcn/ui views + shared components
│   ├── hooks/                   # use-socket (socket.io singleton)
│   ├── stores/                   # Zustand app store (view + theme)
│   └── lib/                      # db, ai, upload, constants, activity, api
├── prisma/schema.prisma          # 5 models
├── mini-services/
│   └── autosocial-daemon/        # socket.io + chokidar watcher (port 3003)
└── .env.example
```

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/posts` | List posts (filter by `status`, `limit`) |
| `POST` | `/api/posts` | Create post (daemon) |
| `POST` | `/api/posts/upload` | Multipart upload (dashboard) |
| `GET/PATCH/DELETE` | `/api/posts/[id]` | Post CRUD |
| `POST` | `/api/posts/[id]/schedule` | Reschedule |
| `GET`  | `/api/stats` | Dashboard summary |
| `GET`  | `/api/analytics` | Chart data |
| `GET/PUT` | `/api/settings` | App settings |
| `GET/PATCH` | `/api/platforms` | Platform toggles |
| `GET`  | `/api/activity` | Audit log |
| `GET/PATCH` | `/api/daemon/poll` | Daemon poll + status update (secret-protected) |
| `POST` | `/api/ai/caption` | Generate AI caption |
| `GET`  | `/api/ai/trends` | AI trend analysis |

## 🔌 WebSocket Events (port 3003)

Connect with `io("/?XTransformPort=3003")`.

| Event | Payload | Description |
|-------|---------|-------------|
| `post.detected` | `{ fileName, title }` | New video found in watch dir |
| `post.created` | `{ post }` | Post record created |
| `upload.progress` | `{ postId, percent }` | Upload progress 0–100 |
| `post.status` | `{ postId, status, platformPostId? }` | Status changed |
| `daemon.log` | `{ level, message, timestamp }` | Daemon log line |

## 🤖 AI Integration

Uses [`z-ai-web-dev-sdk`](https://www.npmjs.com/package/z-ai-web-dev-sdk) (server-side only):

- **`analyzeTrends(fileName, platform)`** → returns `{ optimalTime, recommendedPlatforms, trendingHashtags, reasoning }`
- **`generateCaption(fileName, platform, customPrompt?)`** → returns `{ title, caption, hashtags }`

Both gracefully fall back to heuristics if the LLM is unavailable.

## 📝 License

MIT
