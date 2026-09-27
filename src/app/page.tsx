"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { DashboardView } from "@/components/views/dashboard-view";
import { PostsView } from "@/components/views/posts-view";
import { ScheduleView } from "@/components/views/schedule-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { SettingsView } from "@/components/views/settings-view";

import { useAppStore } from "@/stores/use-app-store";
import { useSocketEvent } from "@/hooks/use-socket";
import { queryKeys } from "@/lib/queries";

function ViewSwitch() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
      >
        {activeView === "dashboard" ? <DashboardView /> : null}
        {activeView === "posts" ? <PostsView /> : null}
        {activeView === "schedule" ? <ScheduleView /> : null}
        {activeView === "analytics" ? <AnalyticsView /> : null}
        {activeView === "settings" ? <SettingsView /> : null}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * AppShell wires the global socket.io event listeners to TanStack Query
 * cache invalidations. Listens for:
 *   - post.detected
 *   - post.created
 *   - upload.progress
 *   - post.status
 *   - daemon.log
 */
function useRealtimeInvalidations() {
  const qc = useQueryClient();

  useSocketEvent<{ postId: string; fileName: string; title: string }>(
    "post.detected",
    (p) => {
      toast.info(`New video detected: ${p.fileName ?? p.title ?? "untitled"}`);
      void qc.invalidateQueries({ queryKey: queryKeys.activity() });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  );

  useSocketEvent<{ post?: { id?: string; title?: string } }>("post.created", (p) => {
    toast.success(`Post created: ${p?.post?.title ?? "untitled"}`);
    void qc.invalidateQueries({ queryKey: ["posts"] });
    void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    void qc.invalidateQueries({ queryKey: queryKeys.activity() });
  });

  useSocketEvent<{ postId: string; percent: number }>("upload.progress", (p) => {
    if (p?.percent === 100) {
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    }
  });

  useSocketEvent<{ postId: string; status: string }>("post.status", (p) => {
    void qc.invalidateQueries({ queryKey: ["posts"] });
    void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    void qc.invalidateQueries({ queryKey: queryKeys.analytics() });
    if (p?.status === "UPLOADED") {
      toast.success("Upload complete");
    } else if (p?.status === "FAILED") {
      toast.error("Upload failed");
    }
  });

  useSocketEvent<{ level?: string; message?: string }>("daemon.log", (log) => {
    // Best-effort: pull recent activity when daemon emits a log.
    if (log?.level === "error") {
      console.error("[daemon]", log?.message);
    }
    void qc.invalidateQueries({ queryKey: queryKeys.activity() });
  });
}

export default function Home() {
  useRealtimeInvalidations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col sm:flex-row">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <ViewSwitch />
            </div>
          </main>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
