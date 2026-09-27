import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLATFORM_VALIDATORS } from "@/lib/platforms";

/**
 * POST /api/platforms/[name]/validate
 *
 * Two modes:
 * 1. With a body of credentials → validate those credentials (preview before save)
 * 2. Without a body → re-validate the currently stored credentials
 *
 * Always makes a real HTTP call to the platform's API.
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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body → validate currently stored credentials
    }

    const creds = {
      accessToken: body.accessToken ?? platform.accessToken ?? undefined,
      refreshToken: body.refreshToken ?? platform.refreshToken ?? undefined,
      apiKey: body.apiKey ?? platform.apiKey ?? undefined,
      apiSecret: body.apiSecret ?? platform.apiSecret ?? undefined,
    };

    const validator = PLATFORM_VALIDATORS[name];
    if (!validator) {
      return NextResponse.json(
        { error: `No validator for platform "${name}"` },
        { status: 400 },
      );
    }

    let result;
    try {
      result = await validator(creds);
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not reach the ${platform.displayName} API: ${err.message}`,
        },
        { status: 504 },
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/platforms/[name]/validate]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
