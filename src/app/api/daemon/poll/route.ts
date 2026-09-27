import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertDaemonSecret, POST_STATUS } from "@/lib/constants";

// GET /api/daemon/poll?secret=... - find due scheduled posts for the daemon to upload
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (!assertDaemonSecret(secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const duePosts = await db.post.findMany({
      where: {
        status: POST_STATUS.SCHEDULED,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
    });

    return NextResponse.json({ posts: duePosts });
  } catch (error: any) {
    console.error("[GET /api/daemon/poll]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/daemon/poll  body: { postId, status, platformPostId?, secret }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, status, platformPostId, secret } = body;

    if (!assertDaemonSecret(secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!postId || !status) {
      return NextResponse.json(
        { error: "postId and status required" },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = { status };
    if (platformPostId) data.platformPostId = platformPostId;
    if (status === POST_STATUS.UPLOADED) data.uploadedAt = new Date();

    const post = await db.post.update({
      where: { id: postId },
      data,
    });

    await logActivity(
      status === POST_STATUS.UPLOADED
        ? "post.uploaded"
        : status === POST_STATUS.UPLOADING
          ? "post.uploading"
          : "post.failed",
      status === POST_STATUS.UPLOADED
        ? `Uploaded "${post.title}" to ${post.platform}`
        : status === POST_STATUS.FAILED
          ? `Upload failed for "${post.title}"`
          : `Started uploading "${post.title}"`,
      post.id,
    );

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error("[PATCH /api/daemon/poll]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
