import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { deleteFile } from "@/lib/upload";
import { POST_STATUS } from "@/lib/constants";

// GET /api/posts/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const post = await db.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/posts/[id]
// Body: { title?, description?, caption?, hashtags?, platform?, scheduledFor?, status? }
export async function PATCH(
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

    const data: Record<string, unknown> = {};
    const allowed = [
      "title",
      "description",
      "caption",
      "hashtags",
      "platform",
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.scheduledFor) {
      data.scheduledFor = new Date(body.scheduledFor);
      data.status = POST_STATUS.SCHEDULED;
    }
    if (body.status && Object.values(POST_STATUS).includes(body.status)) {
      data.status = body.status;
      if (body.status === POST_STATUS.UPLOADED) {
        data.uploadedAt = new Date();
      }
    }
    if (body.platformPostId !== undefined) {
      data.platformPostId = body.platformPostId;
    }

    const post = await db.post.update({ where: { id }, data });

    await logActivity(
      "post.updated",
      `Updated "${post.title}" (${Object.keys(data).join(", ")})`,
      post.id,
    );

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error("[PATCH /api/posts/[id]]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/posts/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const post = await db.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db.post.delete({ where: { id } });
    await deleteFile(post.filePath);
    await logActivity("post.deleted", `Deleted "${post.title}"`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/posts/[id]]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
