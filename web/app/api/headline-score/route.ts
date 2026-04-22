import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { isValidSegment, checkLength, MAX_HEADLINE_LENGTH } from "@/lib/validateInput";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { headline, segment } = body as Record<string, unknown>;

    if (!headline || typeof headline !== "string" || !headline.trim()) {
      return Response.json({ error: "headline is required" }, { status: 400 });
    }

    const headlineErr = checkLength("headline", headline, MAX_HEADLINE_LENGTH);
    if (headlineErr) return headlineErr;

    const audienceLabel =
      isValidSegment(segment) && segment === "large_firm"
        ? "large construction firms (50+ employees)"
        : "small contractors (owner-operators, 1–20 people)";

    const prompt = `You are a conversion copywriter scoring a headline for a B2B SaaS product (PRICEIT — AI construction pricing platform) targeting ${audienceLabel}.

Score this headline ONLY on headline-specific qualities. Ignore anything that requires page context (social proof, CTA, etc.).

HEADLINE: "${headline.trim()}"

Score each dimension 0–10:
1. clarity — Is it immediately clear what the product does and who it's for?
2. specificity — Does it use concrete numbers, outcomes, or timeframes (not vague)?
3. pain_resonance — Does it speak to a real contractor pain (slow quotes, underbidding, lost jobs)?
4. hook_strength — Would a contractor stop scrolling and read more?

Return ONLY valid JSON, no markdown:
{"clarity":<0-10>,"specificity":<0-10>,"pain_resonance":<0-10>,"hook_strength":<0-10>,"score":<0-100 weighted: clarity×0.25 + specificity×0.25 + pain_resonance×0.30 + hook_strength×0.20, multiplied by 10, rounded>}`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 128,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Failed to score headline" }, { status: 502 });

    const result = JSON.parse(match[0]);
    if (typeof result.score !== "number") return Response.json({ error: "Invalid score response" }, { status: 502 });

    return Response.json({ score: Math.round(result.score), breakdown: result });
  } catch {
    return Response.json({ error: "Scoring failed" }, { status: 500 });
  }
}
