"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock,
  Loader2,
  Clock,
  CheckCircle2,
  type LucideIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformBadge } from "@/components/platform-badge";
import { PostStatusBadge } from "@/components/post-status-badge";
import { EmptyState } from "@/components/empty-state";
import { usePosts, queryKeys, type Post } from "@/lib/queries";
import { apiPost, ApiError } from "@/lib/api";

interface DayGroup {
  dateKey: string; // YYYY-MM-DD
  label: string;
  posts: Post[];
}

function groupByDay(posts: Post[]): DayGroup[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const horizon = new Date(startOfToday);
  horizon.setDate(horizon.getDate() + 7);

  const upcoming = posts
    .filter(
      (p) =>
        p.scheduledFor &&
        new Date(p.scheduledFor).getTime() >= startOfToday.getTime() &&
        new Date(p.scheduledFor).getTime() <= horizon.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledFor as string).getTime() -
        new Date(b.scheduledFor as string).getTime(),
    );

  const map = new Map<string, Post[]>();
  for (const p of upcoming) {
    const d = new Date(p.scheduledFor as string);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const groups: DayGroup[] = [];
  for (const [key, list] of map.entries()) {
    const d = new Date(key + "T00:00:00");
    groups.push({
      dateKey: key,
      label: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      posts: list,
    });
  }
  return groups;
}

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
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledFor(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    }
  }, [post]);

  async function submit(scheduleNow: boolean) {
    if (!post) return;
    setSaving(true);
    try {
      await apiPost<{ post: Post }>(
        `/api/posts/${post.id}/schedule`,
        scheduleNow ? { scheduleNow: true } : { scheduledFor: new Date(scheduledFor).toISOString() },
      );
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
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-violet-600 dark:text-violet-400" />
            Reschedule post
          </DialogTitle>
          <DialogDescription>
            Pick a new upload time, or trigger the upload immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sched-at">Upload at</Label>
            <Input
              id="sched-at"
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
          <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
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

function DayHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
        {count} {count === 1 ? "post" : "posts"}
      </span>
    </div>
  );
}

interface TimelineRowProps {
  post: Post;
  onReschedule: (post: Post) => void;
}

function TimelineRow({ post, onReschedule }: TimelineRowProps) {
  const time = post.scheduledFor
    ? new Date(post.scheduledFor).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const Icon: LucideIcon =
    post.status === "UPLOADED" ? CheckCircle2 : CalendarClock;

  return (
    <li className="relative pl-8">
      {/* vertical line */}
      <span
        className="absolute left-3 top-0 h-full w-px bg-border"
        aria-hidden
      />
      {/* dot */}
      <span
        className="absolute left-1.5 top-3 flex size-3.5 items-center justify-center rounded-full bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-950/40"
        aria-hidden
      >
        <span className="size-1.5 rounded-full bg-white" />
      </span>
      <button
        type="button"
        onClick={() => onReschedule(post)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-violet-400 hover:bg-violet-50/50 dark:hover:border-violet-700 dark:hover:bg-violet-950/20"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{post.title}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <PlatformBadge platform={post.platform} />
              <PostStatusBadge status={post.status} />
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{time}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Tap to reschedule
          </p>
        </div>
      </button>
    </li>
  );
}

export function ScheduleView() {
  const { data, isLoading, isError } = usePosts("SCHEDULED");
  const [target, setTarget] = React.useState<Post | null>(null);

  const groups = React.useMemo(
    () => groupByDay(data?.posts ?? []),
    [data?.posts],
  );

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
            <CalendarClock className="size-4 text-violet-600 dark:text-violet-400" />
            Upcoming schedule
          </CardTitle>
          <CardDescription>
            Next 7 days · click any post to reschedule or trigger an immediate upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title="Couldn't load scheduled posts"
              description="The /api/posts endpoint returned an error. Try again in a moment."
            />
          ) : isLoading ? (
            <div className="space-y-6 py-2">
              {Array.from({ length: 3 }).map((_, gi) => (
                <div key={gi} className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title="No upcoming posts"
              description="There are no scheduled posts in the next 7 days. Upload a video and the AI agent will pick an optimal time."
            />
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.dateKey} className="space-y-2">
                  <DayHeader label={g.label} count={g.posts.length} />
                  <ul className="space-y-2">
                    {g.posts.map((p) => (
                      <TimelineRow key={p.id} post={p} onReschedule={setTarget} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RescheduleDialog
        post={target}
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
      />
    </motion.div>
  );
}
