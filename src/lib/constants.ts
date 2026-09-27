// Shared constants and types for AutoSocial

export const POST_STATUS = {
  PENDING: "PENDING",
  SCHEDULED: "SCHEDULED",
  UPLOADING: "UPLOADING",
  UPLOADED: "UPLOADED",
  FAILED: "FAILED",
} as const;

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];

export const STATUS_META: Record<
  PostStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    color: "text-zinc-600 dark:text-zinc-300",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    dot: "bg-zinc-400",
  },
  SCHEDULED: {
    label: "Scheduled",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    dot: "bg-amber-500",
  },
  UPLOADING: {
    label: "Uploading",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-100 dark:bg-sky-950/40",
    dot: "bg-sky-500",
  },
  UPLOADED: {
    label: "Uploaded",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    dot: "bg-emerald-500",
  },
  FAILED: {
    label: "Failed",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-950/40",
    dot: "bg-rose-500",
  },
};

export const PLATFORMS = [
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    icon: "youtube",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#000000",
    icon: "tiktok",
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "#E4405F",
    icon: "instagram",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    color: "#1DA1F2",
    icon: "twitter",
  },
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
];

export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

// Daemon secret check helper
export function assertDaemonSecret(secret?: string | null): boolean {
  return (
    !!secret &&
    !!process.env.DAEMON_SECRET &&
    secret === process.env.DAEMON_SECRET
  );
}

// Default user helper - single user mode for this app
export const DEFAULT_USER = {
  email: "creator@autosocial.app",
  name: "Content Creator",
};
