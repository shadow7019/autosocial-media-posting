"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Video,
  Clock,
  CheckCircle,
  AlertCircle,
  CalendarClock,
  Sparkles,
  Zap,
  Upload,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { PlatformBadge } from "@/components/platform-badge";
import { RelativeTime } from "@/components/relative-time";
import { EmptyState } from "@/components/empty-state";
import { useStats } from "@/lib/queries";
import { useAppStore } from "@/stores/use-app-store";

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  "post.created": Sparkles,
  "post.uploaded": Upload,
  "post.rescheduled": CalendarClock,
  "post.updated": Video,
  "post.deleted": AlertCircle,
  "post.status": CheckCircle,
  "ai.caption": Sparkles,
  "daemon.log": Zap,
};

function ActivityIcon({ action }: { action: string }) {
  const Icon = ACTIVITY_ICON[action] ?? Zap;
  const tone =
    action === "post.deleted"
      ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
      : action === "ai.caption"
        ? "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
        : action === "post.uploaded" || action === "post.status"
          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon className="size-4" />
    </span>
  );
}

/** Countdown that ticks every second toward the scheduled time. */
function Countdown({ target }: { target: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const targetMs = new Date(target).getTime();
  const diff = Math.max(0, targetMs - now);
  const isPast = targetMs <= now;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  if (isPast) {
    return (
      <p className="text-sm text-muted-foreground">
        Should have run already · waiting for daemon
      </p>
    );
  }

  const parts: { v: number; label: string }[] = [];
  if (days > 0) parts.push({ v: days, label: "d" });
  parts.push({ v: hours, label: "h" });
  parts.push({ v: minutes, label: "m" });
  parts.push({ v: seconds, label: "s" });

  return (
    <div className="flex items-end gap-2">
      {parts.map((p, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {String(p.v).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="size-10 rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { data, isLoading, isError } = useStats();
  const setActiveView = useAppStore((s) => s.setActiveView);

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-6" />}
        title="Couldn't load dashboard stats"
        description="The /api/stats endpoint returned an error. The daemon might be busy — try again in a moment."
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }

  const counts = data?.counts;
  const next = data?.nextScheduled ?? null;
  const recentActivity = data?.recentActivity ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Posts"
              value={counts?.total ?? 0}
              icon={<Video className="size-5" />}
              accent="violet"
              subtitle="All time"
            />
            <StatCard
              label="Scheduled"
              value={counts?.scheduled ?? 0}
              icon={<Clock className="size-5" />}
              accent="amber"
              subtitle="Waiting to upload"
            />
            <StatCard
              label="Uploaded"
              value={counts?.uploaded ?? 0}
              icon={<CheckCircle className="size-5" />}
              accent="emerald"
              subtitle={`${counts?.uploadedToday ?? 0} today`}
            />
            <StatCard
              label="Failed"
              value={counts?.failed ?? 0}
              icon={<AlertCircle className="size-5" />}
              accent="rose"
              subtitle="Needs attention"
            />
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Next scheduled post */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-violet-600 dark:text-violet-400" />
              <CardTitle className="text-sm">Next Scheduled Post</CardTitle>
            </div>
            {next ? (
              <PlatformBadge platform={next.platform} />
            ) : null}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ) : next ? (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">{next.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Scheduled for{" "}
                    {new Date(next.scheduledFor).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <Countdown target={next.scheduledFor} />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setActiveView("schedule")}
                >
                  View schedule
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<CalendarClock className="size-6" />}
                title="Nothing scheduled yet"
                description="Upload a video and the AI agent will pick an optimal time automatically."
                action={
                  <Button
                    size="sm"
                    onClick={() => setActiveView("posts")}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    Upload video
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Quick upload CTA */}
        <Card className="relative overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 to-background dark:border-violet-900/40 dark:from-violet-950/30 dark:to-background">
          <CardContent className="flex h-full flex-col justify-between gap-4 pt-0">
            <div className="space-y-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
                <Zap className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Quick Upload
              </h3>
              <p className="text-xs text-muted-foreground">
                Drop a video and let AutoSocial handle captioning, hashtags and
                optimal-time scheduling powered by AI.
              </p>
            </div>
            <Button
              onClick={() => setActiveView("posts")}
              className="h-10 w-full bg-violet-600 text-white hover:bg-violet-700"
            >
              <Upload className="size-4" />
              Go to Upload
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Recent activity */}
      <section>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setActiveView("analytics")}
            >
              View analytics
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="size-6" />}
                title="No activity yet"
                description="Activity like uploads, schedule changes and AI captions will appear here."
              />
            ) : (
              <ul className="max-h-96 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {recentActivity.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <ActivityIcon action={log.action} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {log.details ?? log.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.post?.title ? (
                          <span className="truncate">{log.post.title} · </span>
                        ) : null}
                        <RelativeTime date={log.createdAt} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </motion.div>
  );
}
