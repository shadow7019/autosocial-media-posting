"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  BarChart3,
  Activity,
  CheckCircle2,
  TrendingUp,
  PieChart as PieIcon,
  CalendarDays,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { useAnalytics, type PostStatus } from "@/lib/queries";
import { STATUS_META, PLATFORMS } from "@/lib/constants";

const STATUS_COLORS: Record<PostStatus, string> = {
  PENDING: "#a1a1aa", // zinc-400
  SCHEDULED: "#f59e0b", // amber-500
  UPLOADING: "#0ea5e9", // sky-500
  UPLOADED: "#10b981", // emerald-500
  FAILED: "#f43f5e", // rose-500
};

const VIOLET = "#7c3aed";
const VIOLET_LIGHT = "#c4b5fd";
const EMERALD = "#10b981";

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-2 text-xs shadow-md">
      {label ? (
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      ) : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-popover-foreground">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: p.color }}
            aria-hidden
          />
          <span className="font-medium">{p.name}:</span>
          <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.name ?? id;
}
function platformColor(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.color ?? "#a1a1aa";
}

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-lg" />;
}

export function AnalyticsView() {
  const { data, isLoading, isError } = useAnalytics();

  if (isError) {
    return (
      <EmptyState
        icon={<Activity className="size-6" />}
        title="Couldn't load analytics"
        description="The /api/analytics endpoint returned an error. Try again in a moment."
      />
    );
  }

  const a = data;
  const byStatusData = (a?.byStatus ?? []).map((s) => ({
    name: STATUS_META[s.status]?.label ?? s.status,
    value: s._count,
    color: STATUS_COLORS[s.status],
  }));
  const byDayData = (a?.byDay ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    total: d.total,
    uploaded: d.uploaded,
    failed: d.failed,
  }));
  const byPlatformData = (a?.byPlatform ?? []).map((p) => ({
    name: platformLabel(p.platform),
    count: p._count,
    fill: platformColor(p.platform),
  }));
  const byHourData = (a?.byHour ?? new Array(24).fill(0)).map((v, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    uploads: v,
    peak: v >= Math.max(...(a?.byHour ?? [])) / 2,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* KPI row */}
      <section className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Posts"
              value={a?.totalPosts ?? 0}
              icon={<BarChart3 className="size-5" />}
              accent="violet"
              subtitle={`${a?.uploadedCount ?? 0} uploaded · ${a?.failedCount ?? 0} failed`}
            />
            <StatCard
              label="Success Rate"
              value={`${a?.successRate ?? 0}%`}
              icon={<TrendingUp className="size-5" />}
              accent="emerald"
              subtitle="Uploaded / (uploaded + failed)"
            />
            <StatCard
              label="Uploaded Today"
              value={a?.byDay?.[a.byDay.length - 1]?.uploaded ?? 0}
              icon={<CheckCircle2 className="size-5" />}
              accent="amber"
              subtitle="Most recent calendar day"
            />
          </>
        )}
      </section>

      {/* Area chart - posts per day */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-violet-600 dark:text-violet-400" />
            Posts per day
          </CardTitle>
          <CardDescription>
            Last 14 days · total created vs. successfully uploaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : byDayData.every((d) => d.total === 0) ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No posts yet"
              description="Upload a video to start seeing daily trends."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={byDayData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={VIOLET}
                  strokeWidth={2}
                  fill="url(#violetGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="uploaded"
                  name="Uploaded"
                  stroke={EMERALD}
                  strokeWidth={2}
                  fill="url(#emeraldGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut + platform bar */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieIcon className="size-4 text-violet-600 dark:text-violet-400" />
              Posts by status
            </CardTitle>
            <CardDescription>Distribution across all post statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : byStatusData.every((d) => d.value === 0) ? (
              <EmptyState
                icon={<PieIcon className="size-6" />}
                title="No data yet"
                description="Status distribution appears once you have posts."
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="var(--card)" />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="size-4 text-violet-600 dark:text-violet-400" />
              Posts by platform
            </CardTitle>
            <CardDescription>How content is distributed across platforms.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : byPlatformData.every((d) => d.count === 0) ? (
              <EmptyState
                icon={<BarChart3 className="size-6" />}
                title="No data yet"
                description="Platform distribution appears once you have posts."
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byPlatformData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="count" name="Posts" radius={[6, 6, 0, 0]}>
                    {byPlatformData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* By hour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-violet-600 dark:text-violet-400" />
            Uploads by hour of day
          </CardTitle>
          <CardDescription>
            When uploads actually go live. Peak hours are highlighted in violet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : byHourData.every((d) => d.uploads === 0) ? (
            <EmptyState
              icon={<Clock className="size-6" />}
              title="No upload data yet"
              description="Once posts start uploading successfully, you'll see the hour-of-day distribution here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byHourData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="uploads" name="Uploads" radius={[4, 4, 0, 0]}>
                  {byHourData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.peak ? VIOLET : VIOLET_LIGHT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
