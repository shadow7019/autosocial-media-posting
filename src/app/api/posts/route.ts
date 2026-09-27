import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { logActivity } from "@/lib/activity";
import { assertDaemonSecret, POST_STATUS } from "@/lib/constants";
import { analyzeTrends } from "@/lib/ai";

// GET /api/posts?status=SCHEDULED&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit")) || 50),
    );

    const posts = await db.post.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error("[GET /api/posts]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/posts
// Body: { fileName, filePath, platform?, title?, description?, scheduleNow?, secret? }
// The `secret` field is required when the daemon creates a post.
// When called from the web UI, no secret is required (single-user app).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fileName,
      filePath,
      platform = "youtube",
      title,
      description,
      scheduleNow,
      secret,
    } = body;

    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: "fileName and filePath are required" },
        { status: 400 },
      );
    }

    const fromDaemon = assertDaemonSecret(secret);
    const user = await getOrCreateDefaultUser();

    // Run AI trend analysis to pick an optimal time
    let scheduledFor: Date | null = null;
    let aiReasoning = "";
    let hashtags: string | null = null;

    try {
      const analysis = await analyzeTrends(fileName, platform);
      scheduledFor = scheduleNow ? new Date() : analysis.optimalTime;
      aiReasoning = analysis.reasoning;
      hashtags = analysis.trendingHashtags.join(" ");
    } catch (err) {
      console.error("[POST /api/posts] trend analysis failed:", err);
      scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000);
    }

    const post = await db.post.create({
      data: {
        userId: user.id,
        title: title || fileName.replace(/\.[^.]+$/, ""),
        description: description || null,
        filePath,
        fileName,
        platform,
        status: POST_STATUS.SCHEDULED,
        scheduledFor,
        hashtags,
        aiGenerated: true,
      },
    });

    await logActivity(
      "post.created",
      `Scheduled "${post.title}" for ${scheduledFor?.toISOString()} (${aiReasoning})`,
      post.id,
    );

    console.log(`[POST /api/posts] created ${post.id} via ${fromDaemon ? "daemon" : "ui"}`);

    return NextResponse.json({
      message: "Post created successfully",
      post,
    });
  } catch (error: any) {
    console.error("[POST /api/posts]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
