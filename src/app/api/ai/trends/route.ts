import { NextRequest, NextResponse } from "next/server";
import { analyzeTrends } from "@/lib/ai";

// GET /api/ai/trends?fileName=...&platform=youtube
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName") || "video.mp4";
    const platform = searchParams.get("platform") || "youtube";

    const analysis = await analyzeTrends(fileName, platform);

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error("[GET /api/ai/trends]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
