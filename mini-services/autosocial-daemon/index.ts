/**
 * AutoSocial Daemon — socket.io mini-service (port 3003).
 *
 * Responsibilities:
 *  1. Watch the UPLOAD_DIR for new video files and report them to the Next.js API
 *     via POST /api/posts (with DAEMON_SECRET).
 *  2. Poll GET /api/daemon/poll every POLL_INTERVAL ms for posts whose scheduledFor
 *     time has come, then "execute" the upload (simulated with progress events).
 *  3. Emit real-time events to connected dashboard clients over socket.io:
 *       post.detected, post.created, upload.progress, post.status, daemon.log
 *
 * Connection contract (per Caddy gateway rules):
 *   - The Next.js frontend connects with io("/?XTransformPort=3003").
 *   - We expose socket.io on path "/" so Caddy can forward correctly.
 *   - We talk to the Next.js API at the gateway root, i.e. we hit the
 *     API directly on port 3000 (in this sandbox the daemon and Next.js share
 *     the same machine, so direct localhost:3000 is fine and avoids the
 *     XTransformPort query complexity from the daemon side).
 */

import { createServer, type IncomingMessage } from "http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import { promises as fs } from "fs";
import path from "path";

// ---------- Configuration ----------
const PORT = 3003;
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || "/home/z/my-project/upload";
const API_BASE =
  process.env.API_BASE || "http://localhost:3000";
const DAEMON_SECRET =
  process.env.DAEMON_SECRET || "autosocial-prod-secret-2025";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000; // 30s
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

// ---------- Logging ----------
type LogLevel = "info" | "warn" | "error" | "success";

function log(level: LogLevel, message: string) {
  const ts = new Date().toISOString();
  const prefix = {
    info: "\x1b[36m[INFO]\x1b[0m",
    warn: "\x1b[33m[WARN]\x1b[0m",
    error: "\x1b[31m[ERR ]\x1b[0m",
    success: "\x1b[32m[OK  ]\x1b[0m",
  }[level];
  console.log(`${ts} ${prefix} ${message}`);
  // Push to all connected dashboards
  io?.emit("daemon.log", { level, message, timestamp: ts });
}

// ---------- HTTP helpers (call the Next.js API on port 3000) ----------
async function apiPost(pathname: string, body: unknown) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${pathname} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiGet(pathname: string) {
  const res = await fetch(`${API_BASE}${pathname}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${pathname} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPatch(pathname: string, body: unknown) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH ${pathname} -> ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------- HTTP server + socket.io ----------
const httpServer = createServer((req: IncomingMessage, res) => {
  // Tiny health endpoint so the service is observable
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "autosocial-daemon",
        uptime: process.uptime(),
        watchDir: UPLOAD_DIR,
        connectedClients: io ? io.engine.clientsCount : 0,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

const io = new Server(httpServer, {
  // CRITICAL: path must stay "/" so the Caddy gateway forwards correctly.
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

interface DuePost {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  platform: string;
  scheduledFor: string;
}

io.on("connection", (socket) => {
  log("info", `Dashboard connected (${socket.id}). Total: ${io.engine.clientsCount}`);
  socket.emit("daemon.log", {
    level: "info",
    message: "Connected to AutoSocial daemon",
    timestamp: new Date().toISOString(),
  });

  socket.on("disconnect", (reason) => {
    log("info", `Dashboard disconnected (${socket.id}): ${reason}`);
  });

  // Allow clients to request an immediate poll
  socket.on("trigger-poll", async () => {
    log("info", "Manual poll triggered by dashboard");
    try {
      await pollForDueUploads();
    } catch (err: any) {
      log("error", `Manual poll failed: ${err.message}`);
    }
  });
});

// ---------- Folder watcher ----------
async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function isVideoFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

async function reportNewFile(absolutePath: string) {
  const fileName = path.basename(absolutePath);
  if (!isVideoFile(fileName)) {
    log("info", `Skipping non-video file: ${fileName}`);
    return;
  }

  log("info", `New video detected: ${fileName}`);
  io?.emit("post.detected", { fileName, title: fileName });

  try {
    const result = await apiPost("/api/posts", {
      fileName,
      filePath: absolutePath,
      secret: DAEMON_SECRET,
    });
    log("success", `Reported "${fileName}" -> post ${result.post?.id}`);
    io?.emit("post.created", {
      post: result.post,
      source: "daemon-watcher",
    });
  } catch (err: any) {
    log("error", `Failed to report "${fileName}": ${err.message}`);
  }
}

let watcher: chokidar.FSWatcher | null = null;

async function startWatcher() {
  await ensureUploadDir();

  // chokidar v4: watch() returns a Promise<FSWatcher>
  watcher = await chokidar.watch(UPLOAD_DIR, {
    ignored: /(^|[/\\])\..*|\.tmp$/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 800,
      pollInterval: 200,
    },
  });

  watcher.on("add", (filePath) => {
    reportNewFile(path.resolve(filePath)).catch((err) =>
      log("error", `Watcher add handler crashed: ${err.message}`),
    );
  });
  watcher.on("error", (err) => log("error", `Watcher error: ${err.message}`));

  log("success", `Watching ${UPLOAD_DIR} for new videos`);
}

// ---------- Polling + simulated upload execution ----------
async function pollForDueUploads() {
  let posts: DuePost[] = [];
  try {
    const data = await apiGet(
      `/api/daemon/poll?secret=${encodeURIComponent(DAEMON_SECRET)}`,
    );
    posts = (data.posts || []) as DuePost[];
  } catch (err: any) {
    log("error", `Poll failed: ${err.message}`);
    return;
  }

  if (posts.length === 0) {
    log("info", "Poll: no due posts");
    return;
  }

  log("info", `Poll: ${posts.length} due post(s)`);
  for (const post of posts) {
    await executeUpload(post);
  }
}

async function executeUpload(post: DuePost) {
  log("info", `Executing upload for "${post.title}" (${post.id})`);

  try {
    // Mark as uploading
    await apiPatch("/api/daemon/poll", {
      postId: post.id,
      status: "UPLOADING",
      secret: DAEMON_SECRET,
    });
    io?.emit("post.status", { postId: post.id, status: "UPLOADING" });

    // Simulate progressive upload
    const totalSteps = 10;
    for (let step = 1; step <= totalSteps; step++) {
      await sleep(400); // 400ms per step → ~4s total upload
      const percent = Math.round((step / totalSteps) * 100);
      io?.emit("upload.progress", { postId: post.id, percent });
    }

    // Success
    await apiPatch("/api/daemon/poll", {
      postId: post.id,
      status: "UPLOADED",
      platformPostId: `mock-${post.platform}-${Date.now()}`,
      secret: DAEMON_SECRET,
    });
    io?.emit("post.status", {
      postId: post.id,
      status: "UPLOADED",
      platformPostId: `mock-${post.platform}-${Date.now()}`,
    });
    log("success", `Upload complete: "${post.title}" -> ${post.platform}`);
  } catch (err: any) {
    log("error", `Upload failed for "${post.title}": ${err.message}`);
    try {
      await apiPatch("/api/daemon/poll", {
        postId: post.id,
        status: "FAILED",
        secret: DAEMON_SECRET,
      });
      io?.emit("post.status", { postId: post.id, status: "FAILED" });
    } catch (markErr: any) {
      log("error", `Failed to mark "${post.title}" as FAILED: ${markErr.message}`);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Bootstrap ----------
async function main() {
  log("info", "=== AutoSocial Daemon starting ===");
  log("info", `UPLOAD_DIR = ${UPLOAD_DIR}`);
  log("info", `API_BASE  = ${API_BASE}`);
  log("info", `POLL_INTERVAL = ${POLL_INTERVAL_MS}ms`);

  await startWatcher();

  httpServer.listen(PORT, () => {
    log("success", `socket.io listening on :${PORT} (path "/")`);
  });

  // Initial poll + interval
  setTimeout(() => pollForDueUploads().catch((e) => log("error", e.message)), 1500);
  setInterval(() => {
    pollForDueUploads().catch((e) => log("error", e.message));
  }, POLL_INTERVAL_MS);

  // Heartbeat so we can tell the daemon is alive (no .unref - keeps process alive)
  setInterval(() => {
    log("info", `heartbeat: ${io.engine.clientsCount} client(s)`);
  }, 15_000);
}

// ---------- Graceful shutdown ----------
function shutdown(signal: string) {
  log("warn", `${signal} received, shutting down...`);
  io?.close();
  watcher?.close().catch(() => {});
  httpServer.close(() => {
    log("info", "Daemon stopped");
    process.exit(0);
  });
  // Force exit after 3s if close hangs
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// Ignore SIGHUP so the daemon survives its parent shell exiting
process.on("SIGHUP", () => {
  log("warn", "SIGHUP received (ignored, daemon stays alive)");
});
process.on("uncaughtException", (err) => {
  log("error", `Uncaught: ${err.message}\n${err.stack ?? ""}`);
  // Don't exit - try to keep running
});
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ""}` : String(reason);
  log("error", `Unhandled rejection: ${msg}`);
});

main().catch((err) => {
  log("error", `Fatal: ${err.message}`);
  process.exit(1);
});
