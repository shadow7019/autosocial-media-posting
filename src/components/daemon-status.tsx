"use client";

import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";

interface DaemonStatusProps {
  className?: string;
  /** When false, force the disconnected look (e.g. socket ref unavailable). */
  forceDisconnected?: boolean;
}

/**
 * Small pill that shows whether the AutoSocial daemon mini-service
 * (socket.io on port 3003) is connected. Used in the header + sidebar.
 */
export function DaemonStatus({ className, forceDisconnected }: DaemonStatusProps) {
  const { connected } = useSocket();
  const ok = connected && !forceDisconnected;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        {ok ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            ok ? "bg-emerald-500" : "bg-rose-500",
          )}
        />
      </span>
      {ok ? "Daemon Online" : "Daemon Offline"}
    </span>
  );
}
