import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { logActivity } from "@/lib/activity";
import { POST_STATUS, VIDEO_EXTENSIONS, MAX_UPLOAD_SIZE } from "@/lib/constants";
import { analyzeTrends } from "@/lib/ai";
import {
  saveUploadedFile,
  isVideoFile,
} from "@/lib/upload";
import path from "path";

// POST /api/posts/upload
// multipart/form-data with fields: file (File), platform?, title?, description?, scheduleNow?
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const platform = (formData.get("platform") as string) || "youtube";
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const scheduleNow = formData.get("scheduleNow") === "true";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (!isVideoFile(file.name)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${VIDEO_EXTENSIONS.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 500MB)" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveUploadedFile(buffer, file.name);

    const user = await getOrCreateDefaultUser();

    // AI trend analysis for optimal scheduling
    let scheduledFor: Date | null = null;
    let hashtags: string | null = null;
    try {
      const analysis = await analyzeTrends(file.name, platform);
      scheduledFor = scheduleNow ? new Date() : analysis.optimalTime;
      hashtags = analysis.trendingHashtags.join(" ");
    } catch (err) {
      console.error("[upload] AI trend analysis failed:", err);
      scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000);
    }

    const post = await db.post.create({
      data: {
        userId: user.id,
        title: title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        description,
        filePath: saved.absolutePath,
        fileName: file.name,
        fileSize: saved.size,
        platform,
        status: POST_STATUS.SCHEDULED,
        scheduledFor,
        hashtags,
        aiGenerated: true,
      },
    });

    await logActivity(
      "post.uploaded",
      `Uploaded "${post.title}" (${(saved.size / 1024 / 1024).toFixed(1)} MB)`,
      post.id,
    );

    console.log(
      `[upload] created post ${post.id} from ${file.name} (${saved.size} bytes)`,
    );

    return NextResponse.json({
      message: "Upload successful",
      post,
    });
  } catch (error: any) {
    console.error("[POST /api/posts/upload]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
