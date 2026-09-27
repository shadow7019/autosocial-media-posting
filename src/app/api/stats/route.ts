import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";

// GET /api/stats - dashboard summary
export async function GET() {
  try {
    const [total, pending, scheduled, uploading, uploaded, failed] =
      await Promise.all([
        db.post.count(),
        db.post.count({ where: { status: POST_STATUS.PENDING } }),
        db.post.count({ where: { status: POST_STATUS.SCHEDULED } }),
        db.post.count({ where: { status: POST_STATUS.UPLOADING } }),
        db.post.count({ where: { status: POST_STATUS.UPLOADED } }),
        db.post.count({ where: { status: POST_STATUS.FAILED } }),
      ]);

    // Next scheduled post
    const nextScheduled = await db.post.findFirst({
      where: {
        status: POST_STATUS.SCHEDULED,
        scheduledFor: { gte: new Date() },
      },
      orderBy: { scheduledFor: "asc" },
      select: { id: true, title: true, scheduledFor: true, platform: true },
    });

    // Recent activity (last 8)
    const recentActivity = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { post: { select: { title: true } } },
    });

    // Today's uploads
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const uploadedToday = await db.post.count({
      where: {
        status: POST_STATUS.UPLOADED,
        uploadedAt: { gte: startOfDay },
      },
    });

    // Total upload size
    const sizeAgg = await db.post.aggregate({ _sum: { fileSize: true } });
    const totalSizeBytes = sizeAgg._sum.fileSize || 0;

    return NextResponse.json({
      counts: {
        total,
        pending,
        scheduled,
        uploading,
        uploaded,
        failed,
        uploadedToday,
      },
      nextScheduled,
      recentActivity,
      totalSizeBytes,
    });
  } catch (error: any) {
    console.error("[GET /api/stats]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
