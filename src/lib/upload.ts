import { promises as fs } from "fs";
import path from "path";
import { VIDEO_EXTENSIONS } from "@/lib/constants";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/home/z/my-project/upload";

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function isVideoFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

export function sanitizeFileName(fileName: string): string {
  // Keep it filesystem-safe but readable
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const safe = base
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const timestamp = Date.now();
  return `${safe}-${timestamp}${ext.toLowerCase()}`;
}

export async function saveUploadedFile(
  buffer: Buffer,
  fileName: string,
): Promise<{ absolutePath: string; relativePath: string; size: number }> {
  await ensureUploadDir();
  const safe = sanitizeFileName(fileName);
  const absolutePath = path.join(UPLOAD_DIR, safe);
  await fs.writeFile(absolutePath, buffer);
  const stat = await fs.stat(absolutePath);
  return {
    absolutePath,
    relativePath: `/upload/${safe}`,
    size: stat.size,
  };
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore - file may already be gone
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
