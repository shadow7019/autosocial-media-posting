"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "violet" | "emerald" | "amber" | "rose" | "sky" | "zinc";
  subtitle?: React.ReactNode;
  className?: string;
}

const ACCENT_BORDER: Record<NonNullable<StatCardProps["accent"]>, string> = {
  violet:
    "before:bg-violet-500 dark:before:bg-violet-400",
  emerald:
    "before:bg-emerald-500 dark:before:bg-emerald-400",
  amber: "before:bg-amber-500 dark:before:bg-amber-400",
  rose: "before:bg-rose-500 dark:before:bg-rose-400",
  sky: "before:bg-sky-500 dark:before:bg-sky-400",
  zinc: "before:bg-zinc-400 dark:before:bg-zinc-500",
};

const ACCENT_ICON_BG: Record<NonNullable<StatCardProps["accent"]>, string> = {
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/**
 * Reusable KPI / stat card with a subtle accent stripe across the top.
 */
export function StatCard({
  label,
  value,
  icon,
  accent = "violet",
  subtitle,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md",
        // Top accent bar
        "before:absolute before:inset-x-0 before:top-0 before:h-1 before:content-['']",
        ACCENT_BORDER[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-3xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              ACCENT_ICON_BG[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}
