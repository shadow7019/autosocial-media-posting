"use client";

import * as React from "react";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  type PlatformRow,
  type PlatformCredentials,
  type PlatformValidationResult,
  queryKeys,
  usePlatformValidation,
} from "@/lib/queries";
import { apiPost, ApiError } from "@/lib/api";

// --- Per-platform field schema (hardcoded in the frontend) -------------------

export type FieldKey = "accessToken" | "refreshToken" | "apiKey" | "apiSecret";

export interface FieldSchema {
  field: FieldKey;
  label: string;
  placeholder: string;
  type: "password" | "text";
  required: boolean;
  helpUrl: string;
  helpText: string;
}

export const PLATFORM_FIELDS: Record<string, FieldSchema[]> = {
  youtube: [
    {
      field: "accessToken",
      label: "OAuth2 Access Token",
      placeholder: "ya29...",
      type: "password",
      required: false,
      helpUrl:
        "https://developers.google.com/youtube/v3/guides/auth/installed-apps",
      helpText:
        "OAuth2 token with scope youtube.upload. Get one from the Google OAuth Playground.",
    },
    {
      field: "apiKey",
      label: "API Key (alternative)",
      placeholder: "AIza...",
      type: "password",
      required: false,
      helpUrl: "https://console.cloud.google.com/apis/credentials",
      helpText:
        "A server API key from Google Cloud Console (read-only).",
    },
  ],
  instagram: [
    {
      field: "accessToken",
      label: "Access Token",
      placeholder: "IGQVJ...",
      type: "password",
      required: true,
      helpUrl:
        "https://developers.facebook.com/docs/instagram-basic-display-api/getting-started",
      helpText:
        "Long-lived access token from the Instagram Graph API.",
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
      helpText:
        "User access token from the TikTok Login Kit. Requires an approved app.",
    },
  ],
  twitter: [
    {
      field: "accessToken",
      label: "Bearer Token",
      placeholder: "AAAA...",
      type: "password",
      required: true,
      helpUrl:
        "https://developer.twitter.com/en/docs/authentication/oauth-2-0",
      helpText:
        "App Bearer Token or user OAuth 2.0 access token from the X developer portal.",
    },
  ],
};

function getFields(name: string): FieldSchema[] {
  return PLATFORM_FIELDS[name] ?? [];
}

function hasAnyFilled(values: Partial<Record<FieldKey, string>>): boolean {
  return Object.values(values).some((v) => typeof v === "string" && v.trim().length > 0);
}

function missingRequired(
  fields: FieldSchema[],
  values: Partial<Record<FieldKey, string>>,
): FieldSchema[] {
  return fields.filter((f) => f.required && !(typeof values[f.field] === "string" && values[f.field]!.trim().length > 0));
}

interface ConnectPlatformDialogProps {
  platform: PlatformRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful connection (cache is already invalidated). */
  onConnected?: () => void;
}

/**
 * Connect dialog used by the settings view to validate + store platform
 * credentials. Field schema is hardcoded per platform in `PLATFORM_FIELDS`.
 */
export function ConnectPlatformDialog({
  platform,
  open,
  onOpenChange,
  onConnected,
}: ConnectPlatformDialogProps) {
  const qc = useQueryClient();
  const fields = getFields(platform.name);

  const [values, setValues] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [validation, setValidation] = React.useState<{
    status: "ok" | "error";
    message: string;
  } | null>(null);

  const validationMutation = usePlatformValidation(platform.name);

  // Reset internal state whenever the dialog opens for a fresh session.
  React.useEffect(() => {
    if (open) {
      setValues({});
      setFormError(null);
      setValidation(null);
      setSubmitting(false);
    }
    // We intentionally only re-run when the dialog opens or when the
    // platform changes.
  }, [open, platform.name]);

  function handleChange(field: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Reset stale validation result whenever the user edits a field.
    if (validation) setValidation(null);
  }

  async function handleTest() {
    setFormError(null);
    setValidation(null);

    const missing = missingRequired(fields, values);
    if (missing.length > 0) {
      setFormError(`Required field missing: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    if (!hasAnyFilled(values)) {
      setFormError("Please fill in at least one credential field to test.");
      return;
    }

    const creds: PlatformCredentials = {};
    for (const f of fields) {
      const v = values[f.field];
      if (typeof v === "string" && v.trim().length > 0) creds[f.field] = v.trim();
    }

    try {
      const result = await validationMutation.mutateAsync(creds);
      if (result.ok) {
        setValidation({
          status: "ok",
          message: result.accountName
            ? `Validated as @${result.accountName}`
            : "Credentials validated successfully",
        });
      } else {
        setValidation({
          status: "error",
          message: result.error ?? "Validation failed",
        });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Validation failed";
      setValidation({ status: "error", message: msg });
    }
  }

  async function handleConnect() {
    setFormError(null);
    setValidation(null);

    const missing = missingRequired(fields, values);
    if (missing.length > 0) {
      setFormError(`Required field missing: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    if (!hasAnyFilled(values)) {
      setFormError("Please fill in at least one credential field to connect.");
      return;
    }

    const creds: PlatformCredentials = {};
    for (const f of fields) {
      const v = values[f.field];
      if (typeof v === "string" && v.trim().length > 0) creds[f.field] = v.trim();
    }

    setSubmitting(true);
    try {
      const result = await apiPost<{
        ok: boolean;
        account?: { name?: string | null };
        error?: string;
      }>(`/api/platforms/${encodeURIComponent(platform.name)}/connect`, creds);

      if (result.ok) {
        toast.success(
          `Connected to ${platform.displayName}${result.account?.name ? ` as @${result.account.name}` : ""}`,
        );
        void qc.invalidateQueries({ queryKey: queryKeys.platforms() });
        void qc.invalidateQueries({ queryKey: queryKeys.activity() });
        void qc.invalidateQueries({ queryKey: queryKeys.stats() });
        onConnected?.();
        onOpenChange(false);
      } else {
        const msg = result.error ?? "Connection failed";
        setFormError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Connection failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const testLoading = validationMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="size-4 text-violet-600 dark:text-violet-400" />
            Connect {platform.displayName}
          </DialogTitle>
          <DialogDescription>
            Paste your {platform.displayName} credentials below. We&apos;ll
            validate them by calling the platform&apos;s API before saving.
          </DialogDescription>
        </DialogHeader>

        {/* Top-level error */}
        {formError ? (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {/* Validation preview result */}
        {validation ? (
          <Alert
            className={
              validation.status === "ok"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            }
          >
            {validation.status === "ok" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            <AlertDescription>{validation.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.field} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`pf-${f.field}`} className="text-sm font-medium">
                  {f.label}
                  {f.required ? (
                    <span className="ml-1 text-rose-500" aria-hidden>
                      *
                    </span>
                  ) : null}
                </Label>
                <a
                  href={f.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-400 dark:hover:text-violet-300"
                >
                  Get your token
                  <ExternalLink className="size-3" />
                  <span className="sr-only">
                    {" "}
                    – opens {platform.displayName} developer docs in a new tab
                  </span>
                </a>
              </div>
              <Input
                id={`pf-${f.field}`}
                type={f.type}
                placeholder={f.placeholder}
                autoComplete="off"
                spellCheck={false}
                value={values[f.field] ?? ""}
                onChange={(e) => handleChange(f.field, e.target.value)}
                disabled={submitting || testLoading}
                className="h-10"
                aria-required={f.required}
              />
              <p className="text-xs text-muted-foreground">{f.helpText}</p>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleTest}
            disabled={submitting || testLoading}
            className="min-h-11"
          >
            {testLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Test connection
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="min-h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={submitting || testLoading}
            className="min-h-11 bg-violet-600 text-white hover:bg-violet-700"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
