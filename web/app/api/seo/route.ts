import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { VoiceType, VOICE_PROMPTS } from "@/lib/voices";
import { getSupabase } from "@/lib/supabase";
import { createRateLimiter } from "@/lib/rateLimit";
import {
  isValidVoice,
  isValidSegment,
  checkLength,
  MAX_KEYWORD_LENGTH,
} from "@/lib/validateInput";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// ── SEO Score ─────────────────────────────────────────────────────────────

export interface SeoScoreResult {
  total: number;
  checks: {
    keywordInH1: boolean;
    keywordInMetaTitle: boolean;
    metaDescriptionPresent: boolean;
    wordCount: number;
    wordCountOk: boolean;
    faqPresent: boolean;
    ctaPresent: boolean;
  };
}

// Check if text contains keyword — tries exact match first, then 70% word overlap
function keywordMatch(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const kw = keyword.toLowerCase();
  if (t.includes(kw)) return true;
  // Word overlap fallback
  const kwWords = kw.split(/\s+/).filter((w) => w.length > 3);
  if (kwWords.length === 0) return false;
  const matches = kwWords.filter((w) => t.includes(w));
  return matches.length / kwWords.length >= 0.7;
}

export function scoreSeo(content: string, keyword: string): SeoScoreResult {
  const keywordInH1 = (() => {
    const h1Match = content.match(/^#\s+(.+)$/m);
    return h1Match ? keywordMatch(h1Match[1], keyword) : false;
  })();

  const keywordInMetaTitle = (() => {
    const match = content.match(/META TITLE:\s*(.+)/i);
    return match ? keywordMatch(match[1], keyword) : false;
  })();

  const metaDescriptionPresent = /META DESCRIPTION:\s*.{20,}/i.test(content);
  const wordCount               = content.split(/\s+/).filter(Boolean).length;
  const wordCountOk = wordCount >= 500 && wordCount <= 750;
  const faqPresent = /frequently asked questions|^## FAQ/im.test(content);
  const ctaPresent = /waitlist|beta|priceit\.io|sign up|get access/i.test(content);

  let total = 0;
  if (keywordInH1)            total += 25;
  if (keywordInMetaTitle)     total += 20;
  if (metaDescriptionPresent) total += 15;
  if (wordCountOk)            total += 20;
  if (faqPresent)             total += 12;
  if (ctaPresent)             total += 8;

  return {
    total,
    checks: {
      keywordInH1,
      keywordInMetaTitle,
      metaDescriptionPresent,
      wordCount,
      wordCountOk,
      faqPresent,
      ctaPresent,
    },
  };
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  try {
    const { keyword, segment, voice } = await req.json();

    if (!keyword) {
      return new Response(
        JSON.stringify({ error: "keyword is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const lengthErr = checkLength("keyword", keyword, MAX_KEYWORD_LENGTH);
    if (lengthErr) return lengthErr;

    const safeSegment = isValidSegment(segment) ? segment : "unknown";

    const segmentLabel = safeSegment === "large_firm"
      ? "construction firms with estimating teams (50+ employees)"
      : "small contractors and owner-operators (1–20 people)";

    const voiceKey: VoiceType = isValidVoice(voice) ? voice : "street";

    const systemPrompt = `You write SEO-optimised blog posts for PRICEIT — an AI construction pricing platform in private beta.

PRICEIT lets contractors price any job in under 2 minutes. No spreadsheets. No guessing.

${VOICE_PROMPTS[voiceKey]}

SEO rules:
- Include the target keyword naturally in the H1, first paragraph, and 2–3 H2 subheads
- Answer the search query directly in the first 2 sentences — don't make Google hunt for the answer
- Write for humans first, Google second — no keyword stuffing
- PRICEIT always in all caps
- Output only the blog post — no intro, no commentary`;

    const userPrompt = `Write a complete SEO blog post targeting the keyword: "${keyword}"

Audience: ${segmentLabel}

Use this exact structure — keep the labels so they can be parsed:

META TITLE: [MUST contain the exact keyword "${keyword}" — under 60 chars total]
META DESCRIPTION: [under 160 chars, includes keyword, ends with a soft CTA]

# [H1 — includes keyword, under 60 chars, sentence case]

[Introduction — 2–3 sentences. Answer the search query immediately. Mention PRICEIT naturally.]

## [H2 — first main point, includes keyword variation]

[2–3 paragraphs. Specific numbers and examples. Short sentences.]

## [H2 — second main point]

[2–3 paragraphs. Real contractor scenario. Dollar amounts or time saved.]

## [H2 — third main point]

[2–3 paragraphs. Practical advice. How PRICEIT fits in — don't oversell.]

## Frequently Asked Questions

**[Question 1 — phrased how someone would Google it, includes keyword]**
[Answer — 2–3 sentences, direct, specific]

**[Question 2 — related question]**
[Answer — 2–3 sentences]

**[Question 3 — objection or comparison question]**
[Answer — 2–3 sentences]

## Ready to price every job in 2 minutes?

[2–3 sentence CTA paragraph. Mention PRICEIT beta waitlist. No hard sell.]

Write the full post now. Target 600–700 words total — no more. People have short attention spans. Every sentence must earn its place. Cut anything that doesn't directly help the reader.`;

    const MAX_ATTEMPTS = 2;
    let bestContent = "";
    let bestSeoScore = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const completion = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const seoResult = scoreSeo(content, keyword);

      if (seoResult.total > bestSeoScore) {
        bestSeoScore = seoResult.total;
        bestContent = content;
      }

      if (seoResult.total >= 75) break;
    }

    const finalSeoScore = scoreSeo(bestContent, keyword);

    // ── Save to Supabase for AI training (fire & forget) ───────────────────
    const wordCount = bestContent.split(/\s+/).filter(Boolean).length;
    getSupabase()
      .from("seo_generations")
      .insert({
        keyword,
        segment:    safeSegment,
        voice:      voiceKey,
        content:    bestContent,
        seo_score:  finalSeoScore.total,
        word_count: wordCount,
        seo_checks: finalSeoScore.checks,
        attempts:   MAX_ATTEMPTS,
      })
      .then(({ error }) => {
        if (error) console.error("[supabase:seo_generations]", error.message);
      });

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(bestContent));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-SEO-Score": String(finalSeoScore.total),
        "X-SEO-Checks": JSON.stringify(finalSeoScore.checks),
      },
    });
  } catch (err: unknown) {
    console.error("[/api/seo]", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
