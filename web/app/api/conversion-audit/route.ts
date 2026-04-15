import Groq, { APIError, APIConnectionError, RateLimitError, AuthenticationError } from "groq-sdk";
import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Types ──────────────────────────────────────────────────────────────────

export interface BenchmarkScores {
  headline_clarity: number;
  value_prop:       number;
  social_proof:     number;
  cta_strength:     number;
  pain_points:      number;
  urgency:          number;
}

export interface PainPointCluster {
  category: string;
  status:   "present" | "missing";
  quote:    string | null;
}

export interface Recommendation {
  priority: number;   // 1 = highest
  action:   string;
  impact:   string;
  example:  string;
}

export interface ConversionAuditResult {
  overall_score:       number;
  benchmark_scores:    BenchmarkScores;
  pain_point_clusters: PainPointCluster[];
  recommendations:     Recommendation[];
  headline_variants:   string[];
  lead_magnet_brief:   string;
}

// ── Route ──────────────────────────────────────────────────────────────────

const VALID_SEGMENTS = ["small_contractor", "large_firm"] as const;

export async function POST(req: NextRequest) {
  try {
    // ── Parse body ────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { headline, pageContent, segment, pageUrl } = body as Record<string, unknown>;

    // ── Validate inputs ──────────────────────────────────────────────────
    if (!headline || typeof headline !== "string" || !headline.trim()) {
      return Response.json(
        { error: "headline is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (segment !== undefined && !VALID_SEGMENTS.includes(segment as typeof VALID_SEGMENTS[number])) {
      return Response.json(
        { error: `segment must be one of: ${VALID_SEGMENTS.join(", ")}` },
        { status: 400 }
      );
    }

    if (pageContent !== undefined && typeof pageContent !== "string") {
      return Response.json(
        { error: "pageContent must be a string" },
        { status: 400 }
      );
    }

    if (pageUrl !== undefined && typeof pageUrl !== "string") {
      return Response.json(
        { error: "pageUrl must be a string" },
        { status: 400 }
      );
    }

    const audienceLabel =
      segment === "large_firm"
        ? "large construction firms (50+ employees, dedicated estimating teams)"
        : "small contractors (owner-operators, 1–20 people, pricing jobs manually)";

    const systemPrompt = `You are a conversion rate expert specialising in B2B SaaS landing pages for the construction industry.

PRICEIT is an AI construction pricing platform in private beta. It lets contractors price any job in under 2 minutes — no spreadsheets, no guessing, accurate quotes fast.

Your target audience: ${audienceLabel}.

Return ONLY a valid JSON object. No markdown. No commentary. No trailing text.`;

    const userPrompt = `Audit this page for conversion effectiveness.

HEADLINE: ${headline}
${pageContent ? `\nPAGE CONTENT:\n${pageContent.slice(0, 3000)}` : ""}

Analyse against these 6 benchmarks (score each 0–10):
1. headline_clarity — Is it immediately obvious what PRICEIT does and who it's for?
2. value_prop — Is the core benefit specific, measurable, and differentiated?
3. social_proof — Are there real numbers, names, or proof points?
4. cta_strength — Is there one clear, low-friction call-to-action?
5. pain_points — Does the copy name specific contractor pains (e.g., underbidding, slow estimates)?
6. urgency — Is there a reason to act now (beta, limited spots, time saved)?

Also analyse pain point coverage across these categories: underbidding, slow estimates, lost jobs, margin leakage, spreadsheet fatigue, bid volume.

Return this exact JSON structure:
{
  "overall_score": <0-100, weighted average of benchmarks × 10>,
  "benchmark_scores": {
    "headline_clarity": <0-10>,
    "value_prop": <0-10>,
    "social_proof": <0-10>,
    "cta_strength": <0-10>,
    "pain_points": <0-10>,
    "urgency": <0-10>
  },
  "pain_point_clusters": [
    { "category": "underbidding", "status": "present|missing", "quote": "<exact quote from page or null>" },
    { "category": "slow estimates", "status": "present|missing", "quote": "<exact quote or null>" },
    { "category": "lost jobs", "status": "present|missing", "quote": "<exact quote or null>" },
    { "category": "margin leakage", "status": "present|missing", "quote": "<exact quote or null>" },
    { "category": "spreadsheet fatigue", "status": "present|missing", "quote": "<exact quote or null>" },
    { "category": "bid volume", "status": "present|missing", "quote": "<exact quote or null>" }
  ],
  "recommendations": [
    { "priority": 1, "action": "<what to change>", "impact": "<why this lifts conversion>", "example": "<rewritten copy example>" },
    { "priority": 2, "action": "<what to change>", "impact": "<why>", "example": "<example>" },
    { "priority": 3, "action": "<what to change>", "impact": "<why>", "example": "<example>" }
  ],
  "headline_variants": [
    "<variant 1 — lead with speed/time saved>",
    "<variant 2 — lead with money/margin>",
    "<variant 3 — lead with the competitor pain>"
  ],
  "lead_magnet_brief": "<One paragraph: a specific free resource idea (checklist, calculator, template) that would earn contractor email signups and naturally lead into PRICEIT. Be specific — name the format, the title, and the 3 main items it covers.>"
}`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    if (!raw.trim()) {
      return Response.json(
        { error: "Empty response from AI model — please try again" },
        { status: 502 }
      );
    }

    let result: ConversionAuditResult;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;
      if (!result?.overall_score) throw new Error("Invalid response structure");
    } catch {
      return Response.json(
        { error: "Failed to parse audit result — please try again" },
        { status: 502 }
      );
    }

    // ── Save to Supabase (fire & forget) ──────────────────────────────────
    getSupabase()
      .from("conversion_audits")
      .insert({
        page_url:            pageUrl || null,
        current_headline:    headline,
        page_word_count:     pageContent ? pageContent.split(/\s+/).filter(Boolean).length : null,
        overall_score:       result.overall_score,
        benchmark_scores:    result.benchmark_scores,
        pain_point_clusters: result.pain_point_clusters,
        recommendations:     result.recommendations,
        headline_variants:   result.headline_variants,
        lead_magnet_brief:   result.lead_magnet_brief,
      })
      .then(({ error }) => {
        if (error) console.error("[supabase:conversion_audits]", error.message);
      });

    return Response.json(result);
  } catch (err: unknown) {
    console.error("[/api/conversion-audit]", err);

    // ── Groq SDK typed errors ──────────────────────────────────────────
    if (err instanceof RateLimitError) {
      return Response.json(
        { error: "AI rate limit reached — please wait a moment and try again" },
        { status: 429 }
      );
    }

    if (err instanceof AuthenticationError) {
      return Response.json(
        { error: "AI service authentication failed — contact support" },
        { status: 502 }
      );
    }

    if (err instanceof APIConnectionError) {
      return Response.json(
        { error: "Could not reach AI service — please try again" },
        { status: 503 }
      );
    }

    if (err instanceof APIError) {
      return Response.json(
        { error: "AI service error — please try again" },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
