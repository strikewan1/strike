import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { minimaxChat, parseJsonSafe } from "@/lib/ai/minimax";
import { ANALYZE_REFERENCE_PROMPT } from "@/lib/ai/prompts";
import { ReferenceAnalysisSchema } from "@/lib/ai/schemas";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

const BodySchema = z.object({
  image: z.string().min(100),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`reference:${user.id}`, LIMITS.reference);
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const raw = await minimaxChat(ANALYZE_REFERENCE_PROMPT(parsed.data.image), {
      jsonMode: true,
      maxTokens: 1200,
    });

    const validated = ReferenceAnalysisSchema.safeParse(parseJsonSafe(raw));
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "AI returned invalid response",
          details: validated.error.flatten(),
          raw,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error("[/api/ai/analyze-reference]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
