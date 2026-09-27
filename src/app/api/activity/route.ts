import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/activity?limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit")) || 50),
    );
    const logs = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { post: { select: { title: true } } },
    });
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
