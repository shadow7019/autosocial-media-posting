"use client";

import * as React from "react";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  X,
  FolderUp,
  Folder,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiPostForm,
  apiPostFormMultiple,
  ApiError,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import { VIDEO_EXTENSIONS } from "@/lib/constants";

interface UploadZoneProps {
  /** Optional default platform to send with the upload. */
  defaultPlatform?: string;
  /** Optional callback after a successful upload. */
  onUploaded?: () => void;
  className?: string;
  /** Compact mode renders a thinner button-style dropzone. */
  compact?: boolean;
}

type ItemStatus = "uploading" | "success" | "error";

interface FileUploadItem {
  kind: "file";
  id: string;
  fileName: string;
  size: number;
  percent: number;
  status: ItemStatus;
  error?: string;
}

interface BatchUploadItem {
  kind: "batch";
  id: string;
  label: string; // e.g. "Folder: my-videos/"
  total: number;
  successCount: number;
  failedCount: number;
  totalSizeBytes: number;
  percent: number;
  status: ItemStatus;
  error?: string;
}

type UploadItem = FileUploadItem | BatchUploadItem;

interface BatchResult {
  message?: string;
  successCount: number;
  failedCount: number;
  totalSizeBytes: number;
  results?: Array<{ fileName: string; ok: boolean; size?: number; error?: string }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isVideoFile(name: string): boolean {
  const lower = name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Detects whether the current browser supports directory uploads via the
 * non-standard `webkitdirectory` attribute. Supported in Chrome, Edge,
 * Firefox and Safari 16+.
 */
function supportsDirectoryUpload(): boolean {
  if (typeof document === "undefined") return false;
  const input = document.createElement("input");
  return "webkitdirectory" in input || "directory" in input;
}

/**
 * Drag-and-drop upload zone with XHR-backed progress reporting.
 *
 * Two modes via a small tab toggle:
 *  - "Files": existing single/multi-file behaviour (drag&drop or browse).
 *  - "Folder": uses the `webkitdirectory` input attribute and posts the whole
 *    selection to `/api/posts/upload-batch` as a single multipart request.
 *
 * - Uses native onDragOver / onDrop handlers (no third-party dnd lib).
 * - Reports per-file upload progress bars.
 * - On success: invalidates the posts/stats query and shows a toast.
 * - On error: shows a toast and marks the row red.
 */
export function UploadZone({
  defaultPlatform = "youtube",
  onUploaded,
  className,
  compact = false,
}: UploadZoneProps) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [mode, setMode] = React.useState<"files" | "folder">("files");
  const [folderBusy, setFolderBusy] = React.useState(false);

  const dirSupported = React.useMemo(() => supportsDirectoryUpload(), []);
  const dragCounter = React.useRef(0);

  const invalidateAll = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity() });
  }, [queryClient]);

  const uploadFile = React.useCallback(
    async (file: File) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: FileUploadItem = {
        kind: "file",
        id,
        fileName: file.name,
        size: file.size,
        percent: 0,
        status: "uploading",
      };
      setItems((prev) => [item, ...prev]);

      if (!isVideoFile(file.name)) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.kind === "file"
              ? {
                  ...it,
                  status: "error",
                  error: `Unsupported file type. Allowed: ${VIDEO_EXTENSIONS.join(", ")}`,
                }
              : it,
          ),
        );
        toast.error(`Unsupported file: ${file.name}`);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("platform", defaultPlatform);

      try {
        await apiPostForm(`/api/posts/upload`, formData, (percent) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id && it.kind === "file" ? { ...it, percent } : it,
            ),
          );
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.kind === "file"
              ? { ...it, status: "success", percent: 100 }
              : it,
          ),
        );
        toast.success(`Uploaded "${file.name}"`);
        invalidateAll();
        onUploaded?.();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.kind === "file"
              ? { ...it, status: "error", error: message }
              : it,
          ),
        );
        toast.error(`Upload failed: ${message}`);
      }
    },
    [defaultPlatform, invalidateAll, onUploaded],
  );

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      for (const f of arr) void uploadFile(f);
    },
    [uploadFile],
  );

  const uploadFolder = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setFolderBusy(true);

      // Determine a human-friendly folder label.
      const relPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      const folderName = relPath ? relPath.split("/")[0] : "folder";

      const id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const item: BatchUploadItem = {
        kind: "batch",
        id,
        label: `Folder: ${folderName}/`,
        total: files.length,
        successCount: 0,
        failedCount: 0,
        totalSizeBytes: totalSize,
        percent: 0,
        status: "uploading",
      };
      setItems((prev) => [item, ...prev]);

      try {
        const result = await apiPostFormMultiple<BatchResult>(
          `/api/posts/upload-batch`,
          files,
          (percent) => {
            setItems((prev) =>
              prev.map((it) =>
                it.id === id && it.kind === "batch" ? { ...it, percent } : it,
              ),
            );
          },
          { extraFields: { platform: defaultPlatform } },
        );

        const successCount = result.successCount ?? 0;
        const failedCount = result.failedCount ?? 0;

        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.kind === "batch"
              ? {
                  ...it,
                  percent: 100,
                  status: failedCount === 0 ? "success" : successCount > 0 ? "success" : "error",
                  successCount,
                  failedCount,
                  error: successCount === 0 ? "All files failed" : undefined,
                }
              : it,
          ),
        );

        if (successCount > 0) {
          toast.success(
            `Uploaded ${successCount}/${files.length} files from "${folderName}"`,
          );
          invalidateAll();
          onUploaded?.();
        } else {
          toast.error(`Folder upload failed: no files could be uploaded`);
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Folder upload failed";
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.kind === "batch"
              ? { ...it, status: "error", error: message }
              : it,
          ),
        );
        toast.error(`Folder upload failed: ${message}`);
      } finally {
        setFolderBusy(false);
      }
    },
    [defaultPlatform, invalidateAll, onUploaded],
  );

  const handleFolderInput = React.useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      void uploadFolder(arr);
    },
    [uploadFolder],
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Folder mode ignores drag-drop; only Files mode accepts dropped files.
      if (mode !== "files") return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles, mode],
  );

  const onDragEnter = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "files") return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      setIsDragging(true);
    },
    [mode],
  );

  const onDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "files") return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    },
    [mode],
  );

  const onDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "files") return;
      e.preventDefault();
      e.stopPropagation();
      // DropEffect must be set to "copy" for the drop event to fire.
      e.dataTransfer.dropEffect = "copy";
    },
    [mode],
  );

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Apply / clear the directory attributes whenever the mode changes.
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (mode === "folder") {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
      el.removeAttribute("accept");
      el.removeAttribute("multiple");
    } else {
      el.removeAttribute("webkitdirectory");
      el.removeAttribute("directory");
      el.setAttribute("accept", VIDEO_EXTENSIONS.join(","));
      el.setAttribute("multiple", "");
    }
  }, [mode]);

  const browseLabel = mode === "folder" ? "Choose Folder" : compact ? "Click to browse" : "click to browse";
  const headingText = mode === "folder"
    ? folderBusy
      ? `Uploading ${items.find((i) => i.kind === "batch" && i.status === "uploading")?.total ?? 0} files…`
      : "Upload a whole folder"
    : isDragging
      ? "Drop to upload"
      : "Drag & drop your videos";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (folderBusy) return; // disable while folder upload in progress
            setMode(v as "files" | "folder");
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger
              value="files"
              disabled={folderBusy}
              className="min-w-20 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-950/60 dark:data-[state=active]:text-violet-200"
            >
              <UploadCloud className="size-3.5" />
              Files
            </TabsTrigger>
            <TabsTrigger
              value="folder"
              disabled={folderBusy}
              className="min-w-20 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-950/60 dark:data-[state=active]:text-violet-200"
            >
              <FolderUp className="size-3.5" />
              Folder
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {folderBusy ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Folder upload in progress — tabs locked
          </p>
        ) : null}
      </div>

      {mode === "folder" && !dirSupported ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          <FileWarning className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Your browser does not support folder uploads. Please switch to the
            Files tab or upgrade to a recent version of Chrome, Edge, Firefox
            or Safari 16+.
          </span>
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        aria-label={
          mode === "folder"
            ? "Upload a video folder. Click to choose a folder."
            : "Upload video files. Click to browse or drag and drop."
        }
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
          compact ? "px-4 py-6" : "px-6 py-10",
          mode === "folder" && folderBusy && "cursor-wait opacity-70",
          isDragging
            ? "border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/40"
            : "border-border bg-muted/30 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:border-violet-700 dark:hover:bg-violet-950/20",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_EXTENSIONS.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) {
              if (mode === "folder") {
                handleFolderInput(e.target.files);
              } else {
                handleFiles(e.target.files);
              }
              e.target.value = "";
            }
          }}
        />
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-violet-100 text-violet-600 transition-transform group-hover:scale-105 dark:bg-violet-950/50 dark:text-violet-300",
            compact ? "size-10" : "size-14",
          )}
        >
          {mode === "folder" ? (
            <Folder className={compact ? "size-5" : "size-7"} />
          ) : (
            <UploadCloud className={compact ? "size-5" : "size-7"} />
          )}
        </div>
        <div className="space-y-0.5">
          <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            {headingText}
          </p>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              or{" "}
              <span className="text-violet-600 dark:text-violet-400">{browseLabel}</span>
              {mode === "files" ? (
                <>
                  {" "}
                  · MP4, MOV, AVI, MKV, WEBM, M4V · max 500 MB
                </>
              ) : (
                <>
                  {" "}
                  · all videos in the folder are uploaded at once
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{browseLabel}</p>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {items.length > 0 ? (
          <motion.ul
            key="upload-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-h-72 overflow-y-auto rounded-xl border bg-card pr-1 [scrollbar-width:thin]"
          >
            {items.map((it) =>
              it.kind === "batch" ? (
                <BatchRow key={it.id} item={it} onDismiss={() => dismiss(it.id)} />
              ) : (
                <FileRow key={it.id} item={it} onDismiss={() => dismiss(it.id)} />
              ),
            )}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FileRow({
  item,
  onDismiss,
}: {
  item: FileUploadItem;
  onDismiss: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.fileName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatBytes(item.size)}
          </span>
        </div>
        {item.status === "uploading" ? (
          <div className="flex items-center gap-2">
            <Progress
              value={item.percent}
              className="h-1.5 flex-1 bg-violet-200/50 [&>[data-slot=progress-indicator]]:bg-violet-500"
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {item.percent}%
            </span>
          </div>
        ) : null}
        {item.status === "error" ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{item.error}</p>
        ) : null}
        {item.status === "success" ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Uploaded · scheduled by AI
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {item.status === "uploading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : item.status === "success" ? (
          <CheckCircle2 className="size-4 text-emerald-500" />
        ) : null}
        {item.status !== "uploading" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function BatchRow({
  item,
  onDismiss,
}: {
  item: BatchUploadItem;
  onDismiss: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b bg-violet-50/40 px-3 py-2.5 last:border-b-0 dark:bg-violet-950/20">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
        <Folder className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.label}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {item.total} files · {formatBytes(item.totalSizeBytes)}
          </span>
        </div>
        {item.status === "uploading" ? (
          <>
            <div className="flex items-center gap-2">
              <Progress
                value={item.percent}
                className="h-1.5 flex-1 bg-violet-200/50 [&>[data-slot=progress-indicator]]:bg-violet-500"
              />
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {item.percent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Uploading {item.total} files…
            </p>
          </>
        ) : null}
        {item.status === "error" ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{item.error}</p>
        ) : null}
        {item.status === "success" ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Uploaded {item.successCount}/{item.total}
            {item.failedCount > 0 ? ` · ${item.failedCount} failed` : ""} ·
            scheduled by AI
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {item.status === "uploading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : item.status === "success" ? (
          <CheckCircle2 className="size-4 text-emerald-500" />
        ) : null}
        {item.status !== "uploading" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
