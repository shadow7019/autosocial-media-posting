import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";

// GET /api/analytics - chart data
export async function GET() {
  try {
    // Posts by status (pie)
    const byStatus = await db.post.groupBy({
      by: ["status"],
      _count: true,
    });

    // Posts per day for last 14 days (line)
    const days: { date: string; total: number; uploaded: number; failed: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);

      const [total, uploaded, failed] = await Promise.all([
        db.post.count({
          where: { createdAt: { gte: day, lt: next } },
        }),
        db.post.count({
          where: {
            createdAt: { gte: day, lt: next },
            status: POST_STATUS.UPLOADED,
          },
        }),
        db.post.count({
          where: {
            createdAt: { gte: day, lt: next },
            status: POST_STATUS.FAILED,
          },
        }),
      ]);

      days.push({
        date: day.toISOString().slice(0, 10),
        total,
        uploaded,
        failed,
      });
    }

    // Posts by platform (bar)
    const byPlatform = await db.post.groupBy({
      by: ["platform"],
      _count: true,
    });

    // Success rate
    const totalPosts = byStatus.reduce((s, r) => s + r._count, 0);
    const uploadedCount =
      byStatus.find((r) => r.status === POST_STATUS.UPLOADED)?._count || 0;
    const failedCount =
      byStatus.find((r) => r.status === POST_STATUS.FAILED)?._count || 0;
    const successRate =
      uploadedCount + failedCount > 0
        ? Math.round((uploadedCount / (uploadedCount + failedCount)) * 100)
        : 0;

    // Uploads by hour of day (for optimal-time insight)
    const allUploaded = await db.post.findMany({
      where: { status: POST_STATUS.UPLOADED, uploadedAt: { not: null } },
      select: { uploadedAt: true },
    });
    const byHour: number[] = new Array(24).fill(0);
    for (const p of allUploaded) {
      if (p.uploadedAt) byHour[p.uploadedAt.getHours()]++;
    }

    return NextResponse.json({
      byStatus,
      byDay: days,
      byPlatform,
      successRate,
      totalPosts,
      uploadedCount,
      failedCount,
      byHour,
    });
  } catch (error: any) {
    console.error("[GET /api/analytics]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
