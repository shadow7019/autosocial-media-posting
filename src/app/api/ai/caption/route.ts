import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { generateCaption } from "@/lib/ai";

// POST /api/ai/caption
// body: { postId?: string, fileName?: string, platform?, customPrompt? }
// If postId given, updates the post. Otherwise just returns the suggestion.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, fileName, platform = "youtube", customPrompt } = body;

    let name = fileName;
    if (!name && postId) {
      const post = await db.post.findUnique({ where: { id: postId } });
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      name = post.fileName;
    }
    if (!name) {
      return NextResponse.json(
        { error: "postId or fileName required" },
        { status: 400 },
      );
    }

    const result = await generateCaption(name, platform, customPrompt);

    if (postId) {
      await db.post.update({
        where: { id: postId },
        data: {
          title: result.title,
          caption: result.caption,
          hashtags: result.hashtags.join(" "),
          aiGenerated: true,
        },
      });
      await logActivity(
        "ai.caption",
        `Generated AI caption for "${result.title}"`,
        postId,
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/ai/caption]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
