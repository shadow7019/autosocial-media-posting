/**
 * Global UI store for AutoSocial.
 *
 * - `activeView`   : which top-level tab is selected
 * - `theme`        : "light" | "dark" - persisted to localStorage and applied
 *                    to <html> as a `dark` class via ThemeProvider in layout.tsx
 * - `sidebarOpen`  : mobile sheet open state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppView = "dashboard" | "posts" | "schedule" | "analytics" | "settings";
export type Theme = "light" | "dark";

interface AppState {
  activeView: AppView;
  setActiveView: (v: AppView) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: "dashboard",
      setActiveView: (v) => set({ activeView: v, sidebarOpen: false }),

      theme: "dark",
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "autosocial-app-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist theme + activeView, not sidebarOpen
      partialize: (s) => ({ theme: s.theme, activeView: s.activeView }),
    },
  ),
);
