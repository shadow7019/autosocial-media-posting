/**
 * Real platform connection + validation helpers.
 *
 * Each platform has a `validate` function that actually calls the platform's
 * public API with the provided credentials and returns the connected account's
 * identity if the credentials are valid.
 *
 * These are REAL API calls (no mocks). If the platform's API rejects the
 * credentials, validation fails and the platform stays disconnected.
 */

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface ValidationResult {
  ok: boolean;
  accountId?: string;
  accountName?: string;
  avatar?: string;
  error?: string;
}

type Validator = (creds: PlatformCredentials) => Promise<ValidationResult>;

/**
 * Wrap a fetch call with a timeout so a hanging platform API can never
 * crash the Next.js server. Default 10s.
 */
async function timedFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * YouTube Data API v3.
 * Validates an OAuth2 access token by calling /channels?mine=true.
 * Also supports API-key validation for public data via /videos?id=...
 */
const validateYouTube: Validator = async (creds) => {
  const token = creds.accessToken?.trim();
  if (token) {
    // OAuth2 Bearer token - call /channels?mine=true
    const res = await timedFetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `YouTube API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
      };
    }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) {
      return { ok: true, accountName: "YouTube user (no channel)" };
    }
    return {
      ok: true,
      accountId: item.id,
      accountName: item.snippet?.title || "YouTube channel",
      avatar: item.snippet?.thumbnails?.default?.url,
    };
  }

  const apiKey = creds.apiKey?.trim();
  if (apiKey) {
    // API key alone can't list "mine", but can validate by listing the most
    // popular video. A 200 means the key is valid; a 403 means invalid.
    const res = await timedFetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=most_popular&maxResults=1&key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `YouTube API key invalid (${res.status}): ${body.slice(0, 200)}`,
      };
    }
    return { ok: true, accountName: "YouTube API key (read-only)" };
  }

  return { ok: false, error: "Provide either an OAuth access token or an API key" };
};

/**
 * Instagram Graph API.
 * GET https://graph.instagram.com/me?fields=id,username,profile_picture_url
 */
const validateInstagram: Validator = async (creds) => {
  const token = creds.accessToken?.trim();
  if (!token) {
    return { ok: false, error: "Instagram access token required" };
  }
  const url = `https://graph.instagram.com/me?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(token)}`;
  const res = await timedFetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Instagram API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    };
  }
  const data = await res.json();
  return {
    ok: true,
    accountId: data.id,
    accountName: data.username,
    avatar: data.profile_picture_url,
  };
};

/**
 * TikTok Content Posting API (Display API).
 * GET https://open.tiktokapis.com/v2/user/info/
 * Requires an approved app + user access token.
 */
const validateTikTok: Validator = async (creds) => {
  const token = creds.accessToken?.trim();
  if (!token) {
    return { ok: false, error: "TikTok user access token required" };
  }
  const res = await timedFetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `TikTok API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    };
  }
  const data = await res.json();
  const user = data?.data?.user;
  if (!user) {
    return { ok: false, error: "TikTok did not return user data" };
  }
  return {
    ok: true,
    accountId: user.open_id,
    accountName: user.display_name,
    avatar: user.avatar_url,
  };
};

/**
 * X (Twitter) API v2.
 * App-only Bearer tokens work on /2/tweets/search/recent (read-only public data).
 * User OAuth 2.0 tokens work on /2/users/me.
 * Try /users/me first; if that returns 403 (app-only forbidden), fall back to
 * the search endpoint to confirm the bearer token is valid.
 */
const validateTwitter: Validator = async (creds) => {
  const token = creds.accessToken?.trim();
  if (!token) {
    return { ok: false, error: "X (Twitter) Bearer token required" };
  }

  // Try /users/me first (works for user OAuth tokens)
  const meRes = await timedFetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (meRes.ok) {
    const data = await meRes.json();
    return {
      ok: true,
      accountId: data.data?.id,
      accountName: data.data?.name ?? data.data?.username,
    };
  }

  // If /users/me returned 403 (app-only bearer forbidden), try the search
  // endpoint to confirm the bearer token itself is valid for read access.
  if (meRes.status === 403) {
    const searchRes = await timedFetch(
      "https://api.twitter.com/2/tweets/search/recent?max_results=5&query=nasa",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (searchRes.ok) {
      return {
        ok: true,
        accountName: "X App (read-only Bearer token)",
      };
    }
    const body = await searchRes.text().catch(() => "");
    return {
      ok: false,
      error: `X API ${searchRes.status}: ${body.slice(0, 200) || searchRes.statusText}`,
    };
  }

  const body = await meRes.text().catch(() => "");
  return {
    ok: false,
    error: `X API ${meRes.status}: ${body.slice(0, 200) || meRes.statusText}`,
  };
};

export const PLATFORM_VALIDATORS: Record<string, Validator> = {
  youtube: validateYouTube,
  instagram: validateInstagram,
  tiktok: validateTikTok,
  twitter: validateTwitter,
};

/**
 * Per-platform field schema — what fields the Connect dialog should show.
 */
export interface PlatformFieldSchema {
  field: keyof PlatformCredentials;
  label: string;
  placeholder: string;
  type: "password" | "text";
  required: boolean;
  helpUrl: string;
  helpText: string;
}

export const PLATFORM_FIELDS: Record<string, PlatformFieldSchema[]> = {
  youtube: [
    {
      field: "accessToken",
      label: "OAuth2 Access Token",
      placeholder: "ya29...",
      type: "password",
      required: false,
      helpUrl: "https://developers.google.com/youtube/v3/guides/auth/installed-apps",
      helpText: "OAuth2 token with scope youtube.upload. Get one from the Google OAuth Playground.",
    },
    {
      field: "apiKey",
      label: "API Key (alternative)",
      placeholder: "AIza...",
      type: "password",
      required: false,
      helpUrl: "https://console.cloud.google.com/apis/credentials",
      helpText: "A server API key from Google Cloud Console (read-only).",
    },
  ],
  instagram: [
    {
      field: "accessToken",
      label: "Access Token",
      placeholder: "IGQVJ...",
      type: "password",
      required: true,
      helpUrl: "https://developers.facebook.com/docs/instagram-basic-display-api/getting-started",
      helpText: "Long-lived access token from the Instagram Graph API.",
    },
  ],
  tiktok: [
    {
      field: "accessToken",
      label: "User Access Token",
      placeholder: "act...",
      type: "password",
      required: true,
      helpUrl: "https://developers.tiktok.com/doc/login-kit-web/",
      helpText: "User access token from the TikTok Login Kit. Requires an approved app.",
    },
  ],
  twitter: [
    {
      field: "accessToken",
      label: "Bearer Token",
      placeholder: "AAAA...",
      type: "password",
      required: true,
      helpUrl: "https://developer.twitter.com/en/docs/authentication/oauth-2-0",
      helpText: "App Bearer Token or user OAuth 2.0 access token from the X developer portal.",
    },
  ],
};
