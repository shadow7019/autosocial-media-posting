import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULTS: Record<string, string> = {
  autoSchedule: "true",
  defaultPlatform: "youtube",
  pollIntervalMs: "60000",
  watchDir: "/home/z/my-project/upload",
  aiCaptionEnabled: "true",
  aiTrendEnabled: "true",
};

// GET /api/settings
export async function GET() {
  try {
    const rows = await db.setting.findMany();
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) map[row.key] = row.value;
    return NextResponse.json({ settings: map });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/settings  body: { settings: { key: value, ... } }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const settings: Record<string, string> = body.settings || {};

    const operations = Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    );

    await Promise.all(operations);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[PUT /api/settings]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
