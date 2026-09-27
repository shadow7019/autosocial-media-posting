"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Video,
  MoreHorizontal,
  Sparkles,
  CalendarClock,
  Eye,
  Trash2,
  FileVideo,
  Loader2,
  Hash,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UploadZone } from "@/components/upload-zone";
import { PostStatusBadge } from "@/components/post-status-badge";
import { PlatformBadge } from "@/components/platform-badge";
import { EmptyState } from "@/components/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { usePosts, queryKeys, type Post } from "@/lib/queries";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { PLATFORMS, POST_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | (typeof POST_STATUS)[keyof typeof POST_STATUS];

const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "PENDING",
  "SCHEDULED",
  "UPLOADING",
  "UPLOADED",
  "FAILED",
];

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// --- Reschedule dialog ------------------------------------------------------

function RescheduleDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (post?.scheduledFor) {
      const d = new Date(post.scheduledFor);
      // datetime-local format: YYYY-MM-DDTHH:MM
      const pad = (n: number) => String(n).padStart(2, "0");
      const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setScheduledFor(v);
    } else {
      // Default to 2 hours from now
      const d = new Date(Date.now() + 2 * 3_600_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setScheduledFor(v);
    }
  }, [post]);

  async function submit(scheduleNow: boolean) {
    if (!post) return;
    setSaving(true);
    try {
      await apiPost<{ post: Post }>(`/api/posts/${post.id}/schedule`, scheduleNow ? { scheduleNow: true } : { scheduledFor: new Date(scheduledFor).toISOString() });
      toast.success(scheduleNow ? "Upload scheduled for now" : "Post rescheduled");
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
      void qc.invalidateQueries({ queryKey: queryKeys.analytics() });
      void qc.invalidateQueries({ queryKey: queryKeys.activity() });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reschedule";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription>
            Pick a new upload time, or upload immediately. The daemon will pick this up on the next poll.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-at">Upload at</Label>
            <Input
              id="reschedule-at"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              disabled={saving}
            />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Post: <span className="font-medium text-foreground">{post?.title}</span>
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => submit(true)}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Upload now
          </Button>
          <Button
            onClick={() => submit(false)}
            disabled={saving || !scheduledFor}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- AI caption dialog ------------------------------------------------------

interface CaptionDraft {
  title: string;
  caption: string;
  hashtags: string[];
}

function AICaptionDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState<CaptionDraft | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function generate() {
    if (!post) return;
    setLoading(true);
    setDraft(null);
    try {
      const result = await apiPost<CaptionDraft>(`/api/ai/caption`, {
        postId: post.id,
        platform: post.platform,
      });
      setDraft(result);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "AI caption failed";
      toast.error(msg);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open && post) {
      void generate();
    }
  }, [open, post?.id]);
  async function apply() {
    if (!post || !draft) return;
    setSaving(true);
    try {
      await apiPatch<{ post: Post }>(`/api/posts/${post.id}`, {
        title: draft.title,
        caption: draft.caption,
        hashtags: draft.hashtags.join(" "),
      });
      toast.success("AI caption applied");
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void qc.invalidateQueries({ queryKey: queryKeys.activity() });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to apply caption";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
            AI Generated Caption
          </DialogTitle>
          <DialogDescription>
            Auto-generated title, caption and hashtags for{" "}
            <span className="font-medium text-foreground">{post?.platform}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="size-8 animate-spin text-violet-600 dark:text-violet-400" />
            <p className="text-sm text-muted-foreground">
              Generating optimized caption…
            </p>
          </div>
        ) : draft ? (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Title
              </Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Caption
              </Label>
              <Textarea
                rows={4}
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Hash className="size-3" /> Hashtags
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {draft.hashtags.map((tag, i) => (
                  <Badge
                    key={`${tag}-${i}`}
                    variant="secondary"
                    className="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                  >
                    #{tag}
                  </Badge>
                ))}
                {draft.hashtags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No hashtags</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="No caption generated"
            description="Try again in a moment."
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={apply}
            disabled={!draft || saving}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Apply to post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Post details dialog -----------------------------------------------------

function PostDetailsDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!post) return null;
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "ID", value: <code className="text-xs">{post.id}</code> },
    { label: "Platform", value: <PlatformBadge platform={post.platform} /> },
    { label: "Status", value: <PostStatusBadge status={post.status} /> },
    { label: "File", value: <span className="text-xs">{post.fileName}</span> },
    { label: "Size", value: <span className="text-xs">{formatBytes(post.fileSize)}</span> },
    {
      label: "Scheduled",
      value: post.scheduledFor ? (
        <span className="text-xs">{new Date(post.scheduledFor).toLocaleString()}</span>
      ) : (
        "—"
      ),
    },
    {
      label: "Uploaded",
      value: post.uploadedAt ? (
        <span className="text-xs">{new Date(post.uploadedAt).toLocaleString()}</span>
      ) : (
        "—"
      ),
    },
    { label: "AI generated", value: post.aiGenerated ? "Yes" : "No" },
    {
      label: "Caption",
      value: post.caption ? (
        <p className="max-h-32 overflow-y-auto rounded bg-muted/50 p-2 text-xs">{post.caption}</p>
      ) : (
        <span className="text-xs text-muted-foreground">No caption</span>
      ),
    },
    {
      label: "Hashtags",
      value: post.hashtags ? (
        <div className="flex flex-wrap gap-1">
          {post.hashtags.split(/\s+/).filter(Boolean).map((t, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              #{t.replace(/^#/, "")}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">None</span>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{post.title}</DialogTitle>
          <DialogDescription>Post details</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2 pr-1 [scrollbar-width:thin]">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 border-b pb-2 last:border-b-0">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {r.label}
              </span>
              <span className="col-span-2 text-sm text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main view ---------------------------------------------------------------

export function PostsView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [platformFilter, setPlatformFilter] = React.useState<string>("ALL");

  const { data, isLoading, isError } = usePosts(
    statusFilter === "ALL" ? undefined : statusFilter,
  );

  const [rescheduleTarget, setRescheduleTarget] = React.useState<Post | null>(null);
  const [captionTarget, setCaptionTarget] = React.useState<Post | null>(null);
  const [detailsTarget, setDetailsTarget] = React.useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Post | null>(null);

  async function handleDelete(post: Post) {
    try {
      await apiDelete(`/api/posts/${post.id}`);
      toast.success(`Deleted "${post.title}"`);
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
      void qc.invalidateQueries({ queryKey: queryKeys.analytics() });
      void qc.invalidateQueries({ queryKey: queryKeys.activity() });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleteTarget(null);
    }
  }

  const allPosts = data?.posts ?? [];
  const filtered = React.useMemo(() => {
    if (platformFilter === "ALL") return allPosts;
    return allPosts.filter((p) => p.platform === platformFilter);
  }, [allPosts, platformFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Video className="size-4 text-violet-600 dark:text-violet-400" />
            Upload a video
          </CardTitle>
          <CardDescription>
            Files are stored on disk and a post is created automatically with AI-generated
            captions and an optimal-time schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadZone />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">All posts</CardTitle>
            <CardDescription>
              {filtered.length} {filtered.length === 1 ? "post" : "posts"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <TabsList className="h-9 overflow-x-auto">
                {STATUS_FILTERS.map((s) => (
                  <TabsTrigger key={s} value={s} className="text-xs">
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-9 w-32" size="sm">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All platforms</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isError ? (
            <EmptyState
              icon={<Eye className="size-6" />}
              title="Couldn't load posts"
              description="The /api/posts endpoint returned an error. Try refreshing the page."
            />
          ) : isLoading ? (
            <div className="space-y-2 px-6 pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FileVideo className="size-6" />}
              title={allPosts.length === 0 ? "Drop your first video to get started" : "No posts match these filters"}
              description={
                allPosts.length === 0
                  ? "Upload a video above and AutoSocial will schedule it automatically with AI captions."
                  : "Try changing the status or platform filter."
              }
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto [scrollbar-width:thin]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="pl-6">File</TableHead>
                    <TableHead className="hidden sm:table-cell">Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Scheduled for</TableHead>
                    <TableHead className="w-12 pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <FileVideo className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[14rem] truncate text-sm font-medium text-foreground sm:max-w-[20rem]">
                              {post.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {post.fileName} · {formatBytes(post.fileSize)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <PlatformBadge platform={post.platform} />
                      </TableCell>
                      <TableCell>
                        <PostStatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {post.scheduledFor ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-xs text-muted-foreground">
                                <RelativeTime date={post.scheduledFor} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(post.scheduledFor).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${post.title}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => setCaptionTarget(post)}>
                              <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                              Generate AI caption
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setRescheduleTarget(post)}
                              disabled={
                                post.status === POST_STATUS.UPLOADING ||
                                post.status === POST_STATUS.UPLOADED
                              }
                            >
                              <CalendarClock className="size-4" />
                              Reschedule
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDetailsTarget(post)}>
                              <Eye className="size-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteTarget(post)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RescheduleDialog
        post={rescheduleTarget}
        open={!!rescheduleTarget}
        onOpenChange={(v) => !v && setRescheduleTarget(null)}
      />
      <AICaptionDialog
        post={captionTarget}
        open={!!captionTarget}
        onOpenChange={(v) => !v && setCaptionTarget(null)}
      />
      <PostDetailsDialog
        post={detailsTarget}
        open={!!detailsTarget}
        onOpenChange={(v) => !v && setDetailsTarget(null)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot; and remove the
              underlying file from disk. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
