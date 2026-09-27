"use client";

import { cn } from "@/lib/utils";
import { STATUS_META, type PostStatus } from "@/lib/constants";

interface PostStatusBadgeProps {
  status: PostStatus;
  className?: string;
}

/**
 * Pill badge for a post status, with a colored dot. Uses the shared
 * STATUS_META table from `@/lib/constants`.
 */
export function PostStatusBadge({ status, className }: PostStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.bg,
        meta.color,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}
