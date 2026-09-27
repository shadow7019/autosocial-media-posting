import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { POST_STATUS } from "@/lib/constants";

// POST /api/posts/[id]/schedule
// Body: { scheduledFor: ISO string } | { scheduleNow: true }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.post.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (
      existing.status === POST_STATUS.UPLOADING ||
      existing.status === POST_STATUS.UPLOADED
    ) {
      return NextResponse.json(
        { error: "Cannot reschedule an uploading/uploaded post" },
        { status: 400 },
      );
    }

    const scheduledFor = body.scheduleNow
      ? new Date()
      : new Date(body.scheduledFor);

    if (isNaN(scheduledFor.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledFor date" },
        { status: 400 },
      );
    }

    const post = await db.post.update({
      where: { id },
      data: {
        scheduledFor,
        status: POST_STATUS.SCHEDULED,
      },
    });

    await logActivity(
      "post.rescheduled",
      `Rescheduled "${post.title}" for ${scheduledFor.toISOString()}`,
      post.id,
    );

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error("[POST /api/posts/[id]/schedule]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
