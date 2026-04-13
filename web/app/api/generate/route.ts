import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { scoreContent, QUALITY_THRESHOLD } from "@/lib/contentScorer";
import { VoiceType, VOICE_PROMPTS } from "@/lib/voices";
import { getSupabase } from "@/lib/supabase";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});


const STYLE_GUIDE = `
# PRICEIT Style Guide

## Formatting
- Headlines: Sentence case ("Price every job" not "Price Every Job")
- Numbers: Always numerals ("2 minutes", "3 trades", "60%")
- Dollar amounts: $45K not "$45,000" for round numbers
- Oxford comma: Always use it

## Product Name
- Always: PRICEIT (all caps)
- Never: Priceit, PriceIt, Price It

## LinkedIn post
- Hook: 1–2 lines, no emoji in line 1
- Body: 3–5 short paragraphs, line breaks between each
- CTA: 1 line, direct
- Total: 150–300 words

## Blog post
- Headline: Under 60 characters
- Intro: Lead with pain or stat, max 2 sentences
- Subheads: Every 200–300 words
- End with CTA to beta waitlist

## Email (outreach)
- Subject: Under 50 characters, no clickbait
- Opening line: No "I hope this finds you well"
- Body: 3–5 sentences max
- CTA: One ask only

## Social (Instagram/X)
- Hook in first line
- Max 3 hashtags on Instagram, 0–1 on X
- Use: #contractor #constructiontech #estimating
`;

const ICP = {
  small_contractor: {
    name: "Small Contractor",
    description: "Owner-operators and small crews (1–20 people) who price jobs manually with spreadsheets",
    pain_points: [
      "Pricing jobs manually with spreadsheets",
      "Under-bidding and losing margin",
      "No time to build detailed estimates",
      "Losing jobs to competitors who bid faster",
    ],
    hook: "Stop leaving money on the table — price every job in under 2 minutes",
    language: "Job site language. They know a $45K roof job. Speak their language.",
  },
  large_firm: {
    name: "Large Construction Firm",
    description: "Established firms (50+ employees) with dedicated estimating departments",
    pain_points: [
      "Estimating takes 2–5 days per bid",
      "Rework after scope changes",
      "No audit trail on pricing decisions",
      "Margin misses on large projects",
      "Estimating team bottleneck on bid volume",
    ],
    hook: "Cut estimating time by 60% and never miss a margin target",
    language: "Talk margin and process. They care about audit trails and turnaround time.",
  },
};

// ── Random variation helpers ───────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ANGLES = {
  small_contractor: [
    "a roofing contractor who won a $52K job because he sent the quote the same day the client called",
    "a plumber who lost 3 bids in a row because his competitor priced faster",
    "an electrician who realised he'd been leaving 15–20% margin on the table for 2 years",
    "a small GC who used to spend Sunday nights on spreadsheets and now prices on his phone from the job site",
    "a painter who quoted $8K when the real job was worth $14K — and only found out after",
    "a contractor who nearly went broke underbidding, then fixed his pricing process in one week",
  ],
  large_firm: [
    "an estimating team that takes 4 days per bid and keeps missing the deadline window",
    "a construction director who found out the estimating backlog was costing them 3 bids a month",
    "a CFO who couldn't figure out why margin targets kept slipping on large commercial projects",
    "a head of estimating who had zero audit trail when a client disputed a price",
    "a firm that doubled bid volume without hiring a single new estimator",
    "a PM who spent more time on pricing than on actually managing projects",
  ],
};

const OPENERS = [
  "No preamble. Drop the reader into the middle of the story.",
  "Start with a number or a dollar amount.",
  "Start with a question that hurts a little.",
  "Start with the mistake — then explain it.",
  "Start with the result, then work backwards.",
  "Start with one sentence of pure tension.",
];

// ── Build prompts ──────────────────────────────────────────────────────────

function buildMessages(format: string, segment: string, topic: string | undefined, tone: string | undefined, voice: VoiceType = "street") {
  const icp = ICP[segment as keyof typeof ICP];
  const angle = topic || pick(ANGLES[segment as keyof typeof ANGLES]);
  const opener = pick(OPENERS);

  const systemPrompt = `You write marketing content for PRICEIT — an AI construction pricing platform in private beta.

PRICEIT lets contractors and firms price any job in under 2 minutes. No spreadsheets. No guessing. Just accurate quotes, fast.

${VOICE_PROMPTS[voice]}`;

  const formatInstructions: Record<string, string> = {
    linkedin_post: `Write a LinkedIn post. ${opener}
Story angle: ${angle}
Structure: hook (1-2 lines) → conflict/problem → turning point → what changed → 1-line CTA to join PRICEIT beta.
Length: 150-250 words. No hashtags. Line breaks between paragraphs.`,

    cold_email: `Write a cold outreach email.
Story angle: ${angle}
Format: Subject line (under 50 chars, no clickbait) → blank line → 3-4 sentences max → one CTA.
No "I hope this finds you well". No fluff. Get to the point in sentence 1.
Sign off: [First name], PRICEIT`,

    email_sequence: `Write a 3-email cold outreach sequence.
Story angle: ${angle}
Email 1 (Day 0): Lead with the pain. Short. One ask.
Email 2 (Day 3): One specific result or stat. Different angle from email 1.
Email 3 (Day 7): Either add value (tip/insight) or a clean breakup line.
Each email: Subject + body + sign-off. Keep each under 80 words.`,

    blog_intro: `Write the opening of a blog post.
Story angle: ${angle}
Include: H1 headline (under 60 chars) → 2-sentence intro that opens with pain or a stat → first subhead → first body paragraph (100 words max).
End with a soft CTA to the PRICEIT beta waitlist.`,

    instagram: `Write an Instagram caption using this exact structure:
1. Tell a micro-story in 4-6 short lines (one sentence per line). Name a person, a situation, a number. Make it feel real.
2. One blank line.
3. The lesson or turning point — 1-2 lines max.
4. One blank line.
5. Soft mention of PRICEIT — don't sell hard, just plant the seed.
6. One blank line.
7. 2-3 hashtags: #contractor #constructiontech #estimating

Story angle: ${angle}
Max 120 words total. No emojis. No exclamation marks.`,

    x_post: `Write a single tweet (under 280 chars).
Story angle: ${angle}
One idea. Punchy. ${opener} No corporate speak. 0-1 hashtag.`,

    facebook_post: `Write a Facebook post for a construction audience.
Story angle: ${angle}
${opener}
Structure: hook (1-2 lines) → relatable story → what changed → soft CTA.
Length: 100-200 words. Conversational tone. 1-2 hashtags max.`,

    whatsapp_message: `Write a WhatsApp message for a contractor referral/outreach.
Story angle: ${angle}
Keep it under 100 words. Sound like a text from a colleague, not a sales pitch.
No subject line needed. Start with the name or a quick context-setter.`,

    snapchat: `Write a Snapchat caption (under 50 chars) paired with a 2-line context blurb.
Story angle: ${angle}
Caption: punchy, visual, under 50 chars.
Context: 1-2 short lines that explain the image/situation. No hashtags.`,
  };

  const userPrompt = `${formatInstructions[format] || formatInstructions.linkedin_post}

Audience: ${icp.name} — ${icp.description}
${tone ? `Tone: ${tone}` : ""}

Write it now.`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { format, segment, topic, tone, voice } = await req.json();

    if (!format || !segment) {
      return new Response(
        JSON.stringify({ error: "format and segment are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const MAX_ATTEMPTS = 3;
    let bestContent = "";
    let bestScore = 0;
    let finalScore = 0;

    // ── Internal quality loop (non-streaming) ──────────────────────────────
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const messages = buildMessages(format, segment, topic, tone, (voice as VoiceType) || "street");

      const completion = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        stream: false,
        messages,
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const result = scoreContent(content, format);

      if (result.total > bestScore) {
        bestScore = result.total;
        bestContent = content;
        finalScore = result.total;
      }

      // Good enough — stop early
      if (result.passed) {
        finalScore = result.total;
        bestContent = content;
        break;
      }
    }

    // ── Save to Supabase for AI training (fire & forget) ───────────────────
    const wordCount = bestContent.split(/\s+/).filter(Boolean).length;
    getSupabase()
      .from("content_generations")
      .insert({
        format,
        voice:         (voice as VoiceType) || "street",
        segment:       segment || "unknown",
        topic:         topic   || null,
        content:       bestContent,
        quality_score: finalScore,
        attempts:      MAX_ATTEMPTS,
        word_count:    wordCount,
      })
      .then(({ error }) => {
        if (error) console.error("[supabase:content_generations]", error.message);
      });

    // ── Stream the approved content back ───────────────────────────────────
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(bestContent));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
        "X-Quality-Score": String(finalScore),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/generate]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
