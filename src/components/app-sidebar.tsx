"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Video,
  CalendarClock,
  BarChart3,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DaemonStatus } from "@/components/daemon-status";
import { useAppStore, type AppView } from "@/stores/use-app-store";

interface NavItem {
  id: AppView;
  label: string;
  icon: LucideIcon;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview of your automation pipeline",
  },
  {
    id: "posts",
    label: "Posts",
    icon: Video,
    description: "Upload, manage and schedule content",
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: CalendarClock,
    description: "Upcoming scheduled uploads",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Performance trends and insights",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Platforms, AI and daemon config",
  },
];

export function getViewMeta(view: AppView): NavItem {
  return NAV_ITEMS.find((n) => n.id === view) ?? NAV_ITEMS[0];
}

interface SidebarNavProps {
  onNavigate?: () => void;
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => {
              setActiveView(item.id);
              onNavigate?.();
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-11 w-full justify-start gap-3 px-3 text-sm font-medium",
              isActive
                ? "bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60 dark:hover:text-violet-200"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}

/**
 * Desktop sidebar (>= sm). Fixed to the left, full height.
 */
export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card sm:flex">
      <SidebarBrand />
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b px-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
        <Zap className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-foreground">AutoSocial</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Automation Agent
        </p>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t p-4">
      <DaemonStatus className="w-full justify-center" />
      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        AutoSocial v1.0.0
      </p>
    </div>
  );
}

/**
 * Mobile sidebar rendered inside a Sheet (drawer). Used by app-header.
 */
export function MobileSidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <SidebarNav onNavigate={onClose} />
      <SidebarFooter />
    </div>
  );
}
