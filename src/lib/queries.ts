/**
 * Centralised TanStack Query key factory + thin useQuery wrappers.
 *
 * Keeping the keys here ensures every component invalidates the same cache
 * entry when a websocket event arrives.
 */

import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

// --- Response types (subset that the frontend needs) -------------------------

export type PostStatus =
  | "PENDING"
  | "SCHEDULED"
  | "UPLOADING"
  | "UPLOADED"
  | "FAILED";

export interface Post {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  caption: string | null;
  hashtags: string | null;
  filePath: string;
  fileName: string;
  fileSize: number;
  thumbnailPath: string | null;
  platform: string;
  status: PostStatus;
  scheduledFor: string | null;
  uploadedAt: string | null;
  platformPostId: string | null;
  aiGenerated: boolean;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  post?: { title: string } | null;
}

export interface StatsResponse {
  counts: {
    total: number;
    pending: number;
    scheduled: number;
    uploading: number;
    uploaded: number;
    failed: number;
    uploadedToday: number;
  };
  nextScheduled: {
    id: string;
    title: string;
    platform: string;
    scheduledFor: string;
  } | null;
  recentActivity: ActivityLog[];
  totalSizeBytes: number;
}

export interface AnalyticsResponse {
  byStatus: { status: PostStatus; _count: number }[];
  byDay: { date: string; total: number; uploaded: number; failed: number }[];
  byPlatform: { platform: string; _count: number }[];
  successRate: number;
  totalPosts: number;
  uploadedCount: number;
  failedCount: number;
  byHour: number[];
}

export interface PlatformRow {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  connected: boolean;
  color: string | null;
  icon: string | null;
  // Extended fields (backend now returns these):
  accessToken?: string | null;
  apiKey?: string | null;
  connectedAccountId?: string | null;
  connectedAccountName?: string | null;
  connectedAccountAvatar?: string | null;
  connectedAt?: string | null;
}

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface PlatformValidationResult {
  ok: boolean;
  accountId?: string | null;
  accountName?: string | null;
  avatar?: string | null;
  error?: string | null;
}

export interface PlatformConnectResult {
  ok: boolean;
  platform?: PlatformRow;
  account?: {
    id: string | null;
    name: string | null;
    avatar: string | null;
  };
  error?: string;
}

export interface CaptionResult {
  title: string;
  caption: string;
  hashtags: string[];
}

// --- Query keys -------------------------------------------------------------

export const queryKeys = {
  posts: (status?: string) => ["posts", status ?? "all"] as const,
  stats: () => ["stats"] as const,
  analytics: () => ["analytics"] as const,
  activity: (limit?: number) => ["activity", limit ?? 50] as const,
  settings: () => ["settings"] as const,
  platforms: () => ["platforms"] as const,
  platformValidate: (name: string) => ["platforms", name, "validate"] as const,
};

// --- useQuery helpers -------------------------------------------------------

export function useStats(options?: Omit<UseQueryOptions<StatsResponse>, "queryKey" | "queryFn">) {
  return useQuery<StatsResponse>({
    queryKey: queryKeys.stats(),
    queryFn: () => apiGet<StatsResponse>("/api/stats"),
    refetchInterval: 15_000,
    ...options,
  });
}

export function useAnalytics(
  options?: Omit<UseQueryOptions<AnalyticsResponse>, "queryKey" | "queryFn">,
) {
  return useQuery<AnalyticsResponse>({
    queryKey: queryKeys.analytics(),
    queryFn: () => apiGet<AnalyticsResponse>("/api/analytics"),
    refetchInterval: 30_000,
    ...options,
  });
}

export function useActivity(
  limit = 50,
  options?: Omit<UseQueryOptions<{ logs: ActivityLog[] }>, "queryKey" | "queryFn">,
) {
  return useQuery<{ logs: ActivityLog[] }>({
    queryKey: queryKeys.activity(limit),
    queryFn: () => apiGet<{ logs: ActivityLog[] }>(`/api/activity?limit=${limit}`),
    refetchInterval: 20_000,
    ...options,
  });
}

export function usePosts(
  status?: string,
  options?: Omit<UseQueryOptions<{ posts: Post[] }>, "queryKey" | "queryFn">,
) {
  const qs = status ? `?status=${encodeURIComponent(status)}&limit=200` : "?limit=200";
  return useQuery<{ posts: Post[] }>({
    queryKey: queryKeys.posts(status),
    queryFn: () => apiGet<{ posts: Post[] }>(`/api/posts${qs}`),
    refetchInterval: 15_000,
    ...options,
  });
}

export function useSettings(
  options?: Omit<UseQueryOptions<{ settings: Record<string, string> }>, "queryKey" | "queryFn">,
) {
  return useQuery<{ settings: Record<string, string> }>({
    queryKey: queryKeys.settings(),
    queryFn: () => apiGet<{ settings: Record<string, string> }>("/api/settings"),
    staleTime: 30_000,
    ...options,
  });
}

export function usePlatforms(
  options?: Omit<UseQueryOptions<{ platforms: PlatformRow[] }>, "queryKey" | "queryFn">,
) {
  return useQuery<{ platforms: PlatformRow[] }>({
    queryKey: queryKeys.platforms(),
    queryFn: () => apiGet<{ platforms: PlatformRow[] }>("/api/platforms"),
    staleTime: 30_000,
    ...options,
  });
}

// --- useMutation helpers ----------------------------------------------------

/**
 * Validates platform credentials by calling
 * `POST /api/platforms/[name]/validate`.
 *
 * - Pass a `PlatformCredentials` object in the mutate variables to validate
 *   freshly-typed credentials (preview before saving).
 * - Pass `null` (or `{}`) to re-validate the currently stored credentials.
 *
 * Always returns the raw `PlatformValidationResult` from the backend.
 */
export function usePlatformValidation(name: string) {
  return useMutation<
    PlatformValidationResult,
    Error,
    PlatformCredentials | null | undefined
  >({
    mutationKey: queryKeys.platformValidate(name),
    mutationFn: async (creds) => {
      const body = creds && Object.keys(creds).length > 0 ? creds : undefined;
      return apiPost<PlatformValidationResult>(
        `/api/platforms/${encodeURIComponent(name)}/validate`,
        body,
      );
    },
  });
}
