import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/**
 * DELETE /api/platforms/[name]/disconnect
 * Removes all stored credentials for the platform and marks it disconnected.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const platform = await db.platform.findUnique({ where: { name } });
    if (!platform) {
      return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
    }

    const updated = await db.platform.update({
      where: { name },
      data: {
        connected: false,
        accessToken: null,
        refreshToken: null,
        apiKey: null,
        apiSecret: null,
        connectedAccountId: null,
        connectedAccountName: null,
        connectedAccountAvatar: null,
        connectedAt: null,
      },
    });

    await logActivity(
      "platform.disconnected",
      `Disconnected ${platform.displayName}`,
    );

    return NextResponse.json({ ok: true, platform: updated });
  } catch (error: any) {
    console.error("[DELETE /api/platforms/[name]/disconnect]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
