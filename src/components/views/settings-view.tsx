"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Plug,
  Sparkles,
  TrendingUp,
  FolderInput,
  Save,
  Loader2,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { PlatformConnectionCard } from "@/components/platform-connection-card";
import { ConnectPlatformDialog } from "@/components/connect-platform-dialog";
import { useSettings, usePlatforms, queryKeys } from "@/lib/queries";
import { apiPut, ApiError } from "@/lib/api";
import { PLATFORMS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";

export function SettingsView() {
  const qc = useQueryClient();
  const { data: settingsData, isLoading: settingsLoading } = useSettings();
  const { data: platformsData, isLoading: platformsLoading } = usePlatforms();

  const [form, setForm] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Connect dialog state
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [connectTarget, setConnectTarget] = React.useState<string | null>(null);

  const platforms = platformsData?.platforms ?? [];
  const targetPlatform = platforms.find((p) => p.name === connectTarget) ?? null;

  React.useEffect(() => {
    if (settingsData?.settings) {
      setForm({ ...settingsData.settings });
    }
  }, [settingsData]);

  function update(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: String(value) }));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await apiPut(`/api/settings`, { settings: form });
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: queryKeys.settings() });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function openConnectDialog(name: string) {
    setConnectTarget(name);
    setConnectOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="grid gap-4 lg:grid-cols-2"
    >
      {/* Platforms */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plug className="size-4 text-violet-600 dark:text-violet-400" />
            Platforms
          </CardTitle>
          <CardDescription>
            Connect each platform with real API credentials. AutoSocial
            validates them by calling the platform&apos;s API before saving —
            only then is publishing enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {platformsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <EmptyState
              icon={<Plug className="size-6" />}
              title="No platforms available"
              description="Refresh the page to seed default platforms."
            />
          ) : (
            <ul className="space-y-2">
              {platforms.map((p) => (
                <PlatformConnectionCard
                  key={p.id}
                  platform={p}
                  onConnectClick={() => openConnectDialog(p.name)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Application settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <SettingsIcon className="size-4 text-violet-600 dark:text-violet-400" />
            Application Settings
          </CardTitle>
          <CardDescription>
            Control auto-scheduling, AI features and the daemon poll loop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Auto-schedule */}
              <SettingRow
                icon={<Sparkles className="size-4 text-violet-600 dark:text-violet-400" />}
                title="Auto-schedule new uploads"
                description="Run AI trend analysis on every new upload."
              >
                <Switch
                  checked={form.autoSchedule === "true"}
                  onCheckedChange={(v) => update("autoSchedule", v)}
                  aria-label="Auto-schedule new uploads"
                />
              </SettingRow>

              {/* Default platform */}
              <SettingRow
                icon={<Plug className="size-4 text-violet-600 dark:text-violet-400" />}
                title="Default platform"
                description="Used when no platform is specified."
              >
                <Select
                  value={form.defaultPlatform ?? "youtube"}
                  onValueChange={(v) => update("defaultPlatform", v)}
                >
                  <SelectTrigger className="h-9 w-36" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* AI caption */}
              <SettingRow
                icon={<Sparkles className="size-4 text-violet-600 dark:text-violet-400" />}
                title="AI caption generation"
                description="Generate titles, captions and hashtags with the LLM."
              >
                <Switch
                  checked={form.aiCaptionEnabled === "true"}
                  onCheckedChange={(v) => update("aiCaptionEnabled", v)}
                  aria-label="AI caption enabled"
                />
              </SettingRow>

              {/* AI trends */}
              <SettingRow
                icon={<TrendingUp className="size-4 text-violet-600 dark:text-violet-400" />}
                title="AI trend analysis"
                description="Pick optimal upload times using the LLM trend analyzer."
              >
                <Switch
                  checked={form.aiTrendEnabled === "true"}
                  onCheckedChange={(v) => update("aiTrendEnabled", v)}
                  aria-label="AI trend analysis enabled"
                />
              </SettingRow>

              {/* Poll interval */}
              <SettingRow
                icon={<SettingsIcon className="size-4 text-violet-600 dark:text-violet-400" />}
                title="Poll interval (ms)"
                description="How often the daemon checks for scheduled uploads."
              >
                <Input
                  type="number"
                  min={5000}
                  step={1000}
                  value={form.pollIntervalMs ?? "60000"}
                  onChange={(e) => update("pollIntervalMs", e.target.value)}
                  className="h-9 w-28"
                />
              </SettingRow>

              {/* Watch dir */}
              <SettingRow
                icon={<FolderInput className="size-4 text-violet-600 dark:text-violet-400" />}
                title="Watch directory"
                description="Folder the daemon watches for new videos."
              >
                <Input
                  readOnly
                  value={form.watchDir ?? ""}
                  className="h-9 w-48 truncate font-mono text-xs"
                />
              </SettingRow>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={saveSettings}
            disabled={saving || settingsLoading}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </Button>
        </CardFooter>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-violet-600 dark:text-violet-400" />
            About AutoSocial
          </CardTitle>
          <CardDescription>What this app does and how it&apos;s built.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">AutoSocial</span> is a
            production-ready social media automation agent. Drop a video into the
            upload zone or your watch directory, and the agent will:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Generate an SEO-friendly title, caption and hashtags with the LLM.</li>
            <li>Analyze trends to pick the optimal upload time per platform.</li>
            <li>Schedule the upload and execute it at the right moment via the daemon.</li>
            <li>Stream live upload progress to this dashboard over WebSocket.</li>
          </ul>
          <p>
            Built with Next.js 16, Prisma + SQLite, the z-ai-web-dev-sdk for AI,
            socket.io for realtime, Tailwind CSS 4 and shadcn/ui.
          </p>
        </CardContent>
      </Card>

      {/* Connect dialog */}
      {targetPlatform ? (
        <ConnectPlatformDialog
          platform={targetPlatform}
          open={connectOpen}
          onOpenChange={(open) => {
            setConnectOpen(open);
            if (!open) setConnectTarget(null);
          }}
        />
      ) : null}
    </motion.div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
          {icon}
        </span>
        <div className="min-w-0">
          <Label className="text-sm font-medium text-foreground">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
