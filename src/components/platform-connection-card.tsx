"use client";

import * as React from "react";
import {
  Loader2,
  Plug,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RelativeTime } from "@/components/relative-time";
import {
  type PlatformRow,
  queryKeys,
  usePlatformValidation,
} from "@/lib/queries";
import { apiDelete, apiPatch, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const PLATFORM_ICON_COLORS: Record<string, string> = {
  youtube: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  tiktok: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  twitter: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
};

function initialOf(name?: string | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

interface PlatformConnectionCardProps {
  platform: PlatformRow;
  onConnectClick: () => void;
}

/**
 * Single platform row inside the Settings › Platforms card.
 *
 * Shows connection state (with avatar if available), a "Test" / "Disconnect"
 * button group when connected, a "Connect" button otherwise, and the enable
 * Switch (locked behind a tooltip when not connected).
 */
export function PlatformConnectionCard({
  platform,
  onConnectClick,
}: PlatformConnectionCardProps) {
  const qc = useQueryClient();
  const [toggleBusy, setToggleBusy] = React.useState(false);
  const [testLoading, setTestLoading] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  const validateMutation = usePlatformValidation(platform.name);

  async function handleToggle(next: boolean) {
    if (next && !platform.connected) return; // safety net
    setToggleBusy(true);
    try {
      await apiPatch(`/api/platforms`, { name: platform.name, enabled: next });
      toast.success(
        `${platform.displayName} ${next ? "enabled" : "disabled"}`,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.platforms() });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to toggle platform";
      toast.error(msg);
    } finally {
      setToggleBusy(false);
    }
  }

  async function handleTest() {
    setTestLoading(true);
    try {
      // Empty body → re-validate currently stored credentials.
      const result = await validateMutation.mutateAsync(null);
      if (result.ok) {
        toast.success(
          result.accountName
            ? `${platform.displayName} validated as @${result.accountName}`
            : `${platform.displayName} credentials are valid`,
        );
      } else {
        toast.error(result.error ?? "Validation failed");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Validation failed";
      toast.error(msg);
    } finally {
      setTestLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await apiDelete(`/api/platforms/${encodeURIComponent(platform.name)}/disconnect`);
      toast.success(`Disconnected from ${platform.displayName}`);
      void qc.invalidateQueries({ queryKey: queryKeys.platforms() });
      void qc.invalidateQueries({ queryKey: queryKeys.activity() });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to disconnect";
      toast.error(msg);
    } finally {
      setDisconnecting(false);
    }
  }

  const toggleDisabled = !platform.connected || toggleBusy;
  const avatarUrl = platform.connectedAccountAvatar ?? undefined;
  const accountName = platform.connectedAccountName ?? undefined;

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
      {/* Left: icon + identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${PLATFORM_ICON_COLORS[platform.name] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}
          aria-hidden
        >
          <span
            className="size-3.5 rounded-full"
            style={{ backgroundColor: platform.color ?? undefined }}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {platform.displayName}
            </p>
            {platform.connected ? (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Connected
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1 bg-zinc-100 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400"
              >
                <span className="size-1.5 rounded-full bg-zinc-400" />
                Not connected
              </Badge>
            )}
            {platform.enabled ? (
              <Badge
                variant="outline"
                className="border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
              >
                Enabled
              </Badge>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {platform.connected ? (
              <span className="inline-flex items-center gap-1.5">
                {avatarUrl || accountName ? (
                  <Avatar className="size-5">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={accountName ?? "Account avatar"} />
                    ) : null}
                    <AvatarFallback className="bg-violet-100 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
                      {initialOf(accountName)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                )}
                <span className="truncate">
                  {accountName ? `Connected as ${accountName}` : "Connected"}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Circle className="size-3.5 text-zinc-400" />
                <span>Not connected</span>
              </span>
            )}
            {platform.connectedAt ? (
              <span className="text-muted-foreground/80">
                · linked <RelativeTime date={platform.connectedAt} />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right: actions + enable toggle */}
      <div className="flex shrink-0 items-center gap-2">
        {!platform.connected ? (
          <Button
            variant="outline"
            onClick={onConnectClick}
            className="min-h-11 border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
          >
            <Plug className="size-4" />
            Connect
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={handleTest}
              disabled={testLoading || disconnecting}
              className="min-h-11"
              aria-label={`Re-validate ${platform.displayName} credentials`}
            >
              {testLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              <span className="hidden sm:inline">Test</span>
            </Button>

            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        disabled={testLoading || disconnecting}
                        className="min-h-11 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                        aria-label={`Disconnect ${platform.displayName}`}
                      >
                        {disconnecting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        <span className="hidden sm:inline">Disconnect</span>
                      </Button>
                    </AlertDialogTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Disconnect {platform.displayName}
                </TooltipContent>
              </Tooltip>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disconnect {platform.displayName}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all stored credentials for{" "}
                    {platform.displayName}. You&apos;ll need to reconnect to
                    publish again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={disconnecting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600/30 dark:bg-rose-600 dark:hover:bg-rose-700"
                  >
                    {disconnecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

        {/* Enable toggle — locked behind a tooltip if not connected */}
        {platform.connected ? (
          <Switch
            checked={platform.enabled}
            disabled={toggleDisabled}
            onCheckedChange={handleToggle}
            aria-label={`Toggle ${platform.displayName} publishing`}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Span wrapper so the tooltip fires on a disabled switch */}
              <span tabIndex={0} className="inline-flex cursor-not-allowed">
                <Switch checked={false} disabled aria-label={`Enable ${platform.displayName}`} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Connect first to enable publishing
            </TooltipContent>
          </Tooltip>
        )}
        {toggleBusy ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
    </li>
  );
}
