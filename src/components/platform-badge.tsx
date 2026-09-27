"use client";

import { cn } from "@/lib/utils";
import { PLATFORMS } from "@/lib/constants";

interface PlatformBadgeProps {
  platform: string;
  className?: string;
  showName?: boolean;
}

function getPlatformMeta(id: string) {
  const found = PLATFORMS.find((p) => p.id === id);
  if (found) return { name: found.name, color: found.color };
  return { name: id.charAt(0).toUpperCase() + id.slice(1), color: "#71717a" };
}

/**
 * Compact platform pill with a colored dot and display name.
 */
export function PlatformBadge({
  platform,
  className,
  showName = true,
}: PlatformBadgeProps) {
  const meta = getPlatformMeta(platform);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground whitespace-nowrap",
        className,
      )}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      {showName ? meta.name : null}
    </span>
  );
}
