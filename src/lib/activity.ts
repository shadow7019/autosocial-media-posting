import { db } from "@/lib/db";

export async function logActivity(
  action: string,
  details?: string,
  postId?: string,
) {
  try {
    await db.activityLog.create({
      data: { action, details, postId },
    });
  } catch (err) {
    // logging should never break the main flow
    console.error("[activity] failed to log:", err);
  }
}
