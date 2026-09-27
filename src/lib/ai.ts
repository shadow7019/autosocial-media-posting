import ZAI from "z-ai-web-dev-sdk";

export interface TrendAnalysisResult {
  optimalTime: Date;
  recommendedPlatforms: string[];
  trendingHashtags: string[];
  reasoning: string;
}

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  title: string;
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * AI-powered trend analysis.
 * Asks the LLM for an optimal posting time and trending hashtags
 * based on the file name + current hour + day of week.
 *
 * Falls back to a heuristic if the LLM is unavailable.
 */
export async function analyzeTrends(
  fileName: string,
  platform: string = "youtube",
): Promise<TrendAnalysisResult> {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const hour = now.getHours();

  const fallback: TrendAnalysisResult = {
    optimalTime: computeHeuristicOptimalTime(now),
    recommendedPlatforms: ["YouTube", "TikTok", "Instagram"],
    trendingHashtags: ["#content", "#viral", "#trending"],
    reasoning:
      "Heuristic fallback: next available peak engagement window (12pm, 6pm, 9pm).",
  };

  try {
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "You are a social media strategist. You analyze content and recommend the best posting strategy. Always respond with valid JSON only, no extra text.",
        },
        {
          role: "user",
          content: `Analyze this content for posting on ${platform}.
File name: "${fileName}"
Current day: ${dayName}
Current hour (24h): ${hour}

Respond with JSON in this exact shape:
{
  "hoursFromNow": <integer 1-48>,
  "recommendedPlatforms": ["YouTube", "TikTok", "Instagram"],
  "trendingHashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "reasoning": "<one sentence reason>"
}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const hours = Math.max(
      1,
      Math.min(48, Number(parsed.hoursFromNow) || 2),
    );
    const optimalTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return {
      optimalTime,
      recommendedPlatforms: Array.isArray(parsed.recommendedPlatforms)
        ? parsed.recommendedPlatforms.slice(0, 4)
        : fallback.recommendedPlatforms,
      trendingHashtags: Array.isArray(parsed.trendingHashtags)
        ? parsed.trendingHashtags.slice(0, 8)
        : fallback.trendingHashtags,
      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : fallback.reasoning,
    };
  } catch (err) {
    console.error("[trends] AI analysis failed, using fallback:", err);
    return fallback;
  }
}

/**
 * AI-powered caption + hashtag + title generation for a post.
 */
export async function generateCaption(
  fileName: string,
  platform: string = "youtube",
  customPrompt?: string,
): Promise<CaptionResult> {
  const fallback: CaptionResult = {
    title: fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    caption: `New video drop! Watch until the end 🔥 Let me know your thoughts in the comments.`,
    hashtags: ["#content", "#viral", "#fyp", "#trending"],
  };

  try {
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `You are a viral social media copywriter. Write engaging, concise captions optimized for ${platform}. Respond with JSON only.`,
        },
        {
          role: "user",
          content: `Create a social media post for a video file named "${fileName}".
${customPrompt ? `Additional context: ${customPrompt}` : ""}

Respond with JSON in this exact shape:
{
  "title": "<short catchy title, max 60 chars>",
  "caption": "<engaging caption, max 220 chars, include 1-2 emojis>",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || fallback.title,
      caption: parsed.caption || fallback.caption,
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.slice(0, 8)
        : fallback.hashtags,
    };
  } catch (err) {
    console.error("[captions] AI generation failed, using fallback:", err);
    return fallback;
  }
}

/**
 * Pure heuristic for optimal posting time.
 * Snaps to the next available peak engagement window.
 */
function computeHeuristicOptimalTime(now: Date): Date {
  const peakHours = [12, 18, 21]; // 12pm, 6pm, 9pm
  const result = new Date(now);
  const currentHour = now.getHours();

  for (const peak of peakHours) {
    if (peak > currentHour) {
      result.setHours(peak, 0, 0, 0);
      return result;
    }
  }

  // No more peaks today - schedule for tomorrow noon
  result.setDate(result.getDate() + 1);
  result.setHours(12, 0, 0, 0);
  return result;
}
