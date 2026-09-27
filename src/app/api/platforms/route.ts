import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLATFORMS } from "@/lib/constants";

// GET /api/platforms
export async function GET() {
  try {
    const rows = await db.platform.findMany();
    const map = new Map(rows.map((r) => [r.name, r]));

    // Ensure all default platforms exist in DB
    const missing = PLATFORMS.filter((p) => !map.has(p.id));
    if (missing.length) {
      await db.platform.createMany({
        data: missing.map((p) => ({
          name: p.id,
          displayName: p.name,
          color: p.color,
          icon: p.icon,
        })),
      });
      const refreshed = await db.platform.findMany();
      return NextResponse.json({ platforms: refreshed });
    }

    return NextResponse.json({ platforms: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/platforms  body: { name, enabled }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, enabled } = body;
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const platform = await db.platform.update({
      where: { name },
      data: { enabled: !!enabled },
    });
    return NextResponse.json({ platform });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
