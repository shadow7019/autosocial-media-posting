import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { logActivity } from "@/lib/activity";
import { POST_STATUS, VIDEO_EXTENSIONS, MAX_UPLOAD_SIZE } from "@/lib/constants";
import { analyzeTrends } from "@/lib/ai";
import { saveUploadedFile, isVideoFile } from "@/lib/upload";

/**
 * POST /api/posts/upload-batch
 * multipart/form-data with field `files` (multiple File entries) and optional
 * `platform`, `scheduleNow`. Used for folder uploads (webkitdirectory).
 *
 * Returns per-file results so the client can show success/failure per file.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const platform = (formData.get("platform") as string) || "youtube";
    const scheduleNow = formData.get("scheduleNow") === "true";
    const allFiles = formData.getAll("files");

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 },
      );
    }

    const user = await getOrCreateDefaultUser();
    const results: Array<{
      fileName: string;
      ok: boolean;
      postId?: string;
      size?: number;
      error?: string;
    }> = [];

    let totalSize = 0;
    let successCount = 0;

    // Process files sequentially to avoid stacking LLM calls and OOMing
    for (const entry of allFiles) {
      if (!(entry instanceof File)) continue;
      const file = entry as File;

      if (!isVideoFile(file.name)) {
        results.push({
          fileName: file.name,
          ok: false,
          error: "Not a video file",
        });
        continue;
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        results.push({
          fileName: file.name,
          ok: false,
          error: "File too large (max 500MB)",
        });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const saved = await saveUploadedFile(buffer, file.name);
        totalSize += saved.size;

        // AI trend analysis with a hard timeout so a slow LLM never blocks
        // the upload pipeline.
        let scheduledFor: Date | null = null;
        let hashtags: string | null = null;
        try {
          const analysis = await Promise.race([
            analyzeTrends(file.name, platform),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
          ]);
          if (analysis) {
            scheduledFor = scheduleNow ? new Date() : analysis.optimalTime;
            hashtags = analysis.trendingHashtags.join(" ");
          } else {
            scheduledFor = scheduleNow
              ? new Date()
              : new Date(Date.now() + 2 * 60 * 60 * 1000);
          }
        } catch (err) {
          console.error("[upload-batch] AI failed:", err);
          scheduledFor = scheduleNow
            ? new Date()
            : new Date(Date.now() + 2 * 60 * 60 * 1000);
        }

        const post = await db.post.create({
          data: {
            userId: user.id,
            title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
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
          `Uploaded "${post.title}" (${(saved.size / 1024 / 1024).toFixed(1)} MB) via batch upload`,
          post.id,
        );

        results.push({
          fileName: file.name,
          ok: true,
          postId: post.id,
          size: saved.size,
        });
        successCount++;
      } catch (err: any) {
        results.push({
          fileName: file.name,
          ok: false,
          error: err.message,
        });
      }
    }

    console.log(
      `[upload-batch] ${successCount}/${allFiles.length} files uploaded (${(totalSize / 1024 / 1024).toFixed(1)} MB total)`,
    );

    return NextResponse.json({
      message: `Uploaded ${successCount} of ${allFiles.length} files`,
      successCount,
      failedCount: allFiles.length - successCount,
      totalSizeBytes: totalSize,
      results,
    });
  } catch (error: any) {
    console.error("[POST /api/posts/upload-batch]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
