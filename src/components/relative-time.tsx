"use client";

import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";

interface RelativeTimeProps {
  /** ISO date string or Date object. */
  date: string | Date | null | undefined;
  /** Suffix, default " ago" (e.g. "2 minutes ago"). */
  addSuffix?: boolean;
  className?: string;
  /** Re-render interval in ms. Default 30s. */
  intervalMs?: number;
}

interface Resolved {
  text: string;
  title: string;
}

function resolve(date: string | Date, addSuffix: boolean): Resolved | null {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  try {
    return {
      text: formatDistanceToNowStrict(d, { addSuffix }),
      title: d.toLocaleString(),
    };
  } catch {
    return null;
  }
}

/**
 * Renders a human "x minutes ago" string and re-renders on an interval so
 * the displayed value stays fresh.
 *
 * Returns an em-dash when no date is supplied.
 */
export function RelativeTime({
  date,
  addSuffix = true,
  className,
  intervalMs = 30_000,
}: RelativeTimeProps) {
  const [, force] = React.useReducer((n) => n + 1, 0);

  React.useEffect(() => {
    if (!date) return;
    const id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [date, intervalMs]);

  if (!date) return <span className={className}>—</span>;

  const resolved = resolve(date, addSuffix);
  if (!resolved) return <span className={className}>—</span>;

  return (
    <span className={className} title={resolved.title}>
      {resolved.text}
    </span>
  );
}
