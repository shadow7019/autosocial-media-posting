import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { PLATFORM_VALIDATORS, type PlatformCredentials } from "@/lib/platforms";

/**
 * POST /api/platforms/[name]/connect
 * body: PlatformCredentials { accessToken?, refreshToken?, apiKey?, apiSecret? }
 *
 * Validates credentials against the real platform API, then stores them
 * (locally, in SQLite) and marks the platform as connected.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const platform = await db.platform.findUnique({ where: { name } });
    if (!platform) {
      return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
    }

    const body = (await request.json()) as PlatformCredentials;
    const validator = PLATFORM_VALIDATORS[name];
    if (!validator) {
      return NextResponse.json(
        { error: `No validator for platform "${name}"` },
        { status: 400 },
      );
    }

    // Run real validation (network errors are caught and returned as failures)
    let result;
    try {
      result = await validator(body);
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not reach ${platform.displayName} API: ${err.message}`,
        },
        { status: 504 },
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Validation failed",
        },
        { status: 400 },
      );
    }

    // Persist credentials + account info
    const updated = await db.platform.update({
      where: { name },
      data: {
        connected: true,
        accessToken: body.accessToken ?? null,
        refreshToken: body.refreshToken ?? null,
        apiKey: body.apiKey ?? null,
        apiSecret: body.apiSecret ?? null,
        connectedAccountId: result.accountId ?? null,
        connectedAccountName: result.accountName ?? null,
        connectedAccountAvatar: result.avatar ?? null,
        connectedAt: new Date(),
        enabled: true,
      },
    });

    await logActivity(
      "platform.connected",
      `Connected ${platform.displayName}${result.accountName ? ` as "${result.accountName}"` : ""}`,
    );

    return NextResponse.json({
      ok: true,
      platform: updated,
      account: {
        id: result.accountId,
        name: result.accountName,
        avatar: result.avatar,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/platforms/[name]/connect]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
