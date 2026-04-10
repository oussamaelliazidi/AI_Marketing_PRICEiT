import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── Brand Context (inlined so no FS reads at runtime) ──────────────────────

const VOICE = `
# PRICEIT Brand Voice

## Core Personality
PRICEIT speaks like a straight-talking contractor who also happens to understand software. Practical, no-nonsense, built-for-the-field energy. We respect our audience's time and intelligence.

## Tone
- Direct — Say what you mean. No fluff, no buzzwords.
- Confident — We know our product works. No hedging.
- Human — We talk like a person, not a brand.
- Urgent but not pushy — Beta spots are real, scarcity is real, but we don't beg.

## Writing Rules
- Short sentences win. If you can cut a word, cut it.
- Lead with the problem, not the product.
- Use numbers when you can ("2 minutes", "60%", "$45K job").
- NEVER say: "leverage", "synergy", "game-changer", "revolutionary", "cutting-edge", "world-class".
- NEVER start with "We" — start with "You" or the pain.
- Active voice always. Passive voice never.
- Contractions are fine and preferred.

## Content Don'ts
- Vague promises: "Transform your business"
- Corporate speak: "end-to-end solution", "best-in-class"
- Excessive exclamation marks
- AI-sounding phrases: "In today's fast-paced world...", "It's no secret that..."
`;

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

const FORMAT_PROMPTS: Record<string, string> = {
  linkedin_post: `Write a LinkedIn post for PRICEIT.
Format: Hook (1–2 lines, no emoji), then 3–5 short paragraphs separated by blank lines, then 1-line CTA.
Total: 150–300 words. No hashtags.`,

  cold_email: `Write a cold outreach email for PRICEIT.
Format:
Subject: [under 50 chars]
---
[3–5 sentence body, no "I hope this finds you well"]
[Single clear CTA]
[Signature: First name, PRICEIT]`,

  blog_intro: `Write the opening section of a blog post for PRICEIT.
Include: H1 headline (under 60 chars, sentence case) + intro paragraph (2 sentences, lead with pain or stat) + first subhead + first body paragraph (100–150 words).`,

  instagram: `Write an Instagram post for PRICEIT.
Format: Strong hook first line, 3–5 short lines of body, blank line, 2–3 hashtags from: #contractor #constructiontech #estimating #constructionbusiness #contractortips`,

  x_post: `Write an X (Twitter) post for PRICEIT.
Max 280 characters. Hook first. One idea only. 0–1 hashtag.`,

  email_sequence: `Write a 3-email outreach sequence for PRICEIT (Day 0, Day 3, Day 7).
Each email: Subject line + 3–5 sentence body + single CTA.
Day 0: Pain-led cold email. Day 3: Social proof follow-up. Day 7: Value-add or break-up.`,
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

export async function POST(req: NextRequest) {
  try {
    const { format, segment, topic, tone } = await req.json();

    if (!format || !segment) {
      return new Response(
        JSON.stringify({ error: "format and segment are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const icp = ICP[segment as keyof typeof ICP];
    const angle = topic || pick(ANGLES[segment as keyof typeof ANGLES]);
    const opener = pick(OPENERS);

    const systemPrompt = `You write marketing content for PRICEIT — an AI construction pricing platform in private beta.

PRICEIT lets contractors and firms price any job in under 2 minutes. No spreadsheets. No guessing. Just accurate quotes, fast.

Your writing rules:
- Sound like a person, not a brand
- Short sentences. Active voice. No fluff.
- Use real numbers when possible ($45K, 3 days, 60%)
- Never use: "leverage", "game-changer", "revolutionary", "in today's world", "it's no secret"
- PRICEIT is always all caps
- Output only the content — no intro, no "here's your post", no commentary`;

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

      instagram: `Write an Instagram caption.
Story angle: ${angle}
${opener}
Short punchy lines. Max 100 words. End with 2-3 hashtags from: #contractor #constructiontech #estimating #contractorbusiness`,

      x_post: `Write a single tweet (under 280 chars).
Story angle: ${angle}
One idea. Punchy. ${opener} No corporate speak. 0-1 hashtag.`,
    };

    const userPrompt = `${formatInstructions[format] || formatInstructions.linkedin_post}

Audience: ${icp.name} — ${icp.description}
${tone ? `Tone: ${tone}` : ""}

Write it now.`;

    // Stream response via Groq (free tier: llama-3.3-70b-versatile)
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
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
