"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileSidebarContent, getViewMeta } from "@/components/app-sidebar";
import { DaemonStatus } from "@/components/daemon-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppStore } from "@/stores/use-app-store";

/**
 * Sticky top header bar.
 *  - Mobile: hamburger button on the left to open the sidebar sheet
 *  - All sizes: page title + description, daemon status pill, theme toggle
 */
export function AppHeader() {
  const activeView = useAppStore((s) => s.activeView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const meta = getViewMeta(activeView);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 sm:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 sm:max-w-xs">
          <SheetTitle className="sr-only">AutoSocial navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Select a section to navigate the app.
          </SheetDescription>
          <MobileSidebarContent onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
          {meta.label}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
      </div>

      <div className="flex items-center gap-2">
        <DaemonStatus className="hidden sm:inline-flex" />
        <ThemeToggle />
      </div>
    </header>
  );
}
