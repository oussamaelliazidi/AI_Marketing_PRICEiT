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
    const formatPrompt = FORMAT_PROMPTS[format] || FORMAT_PROMPTS.linkedin_post;

    const systemPrompt = `You are PRICEIT's content writer. PRICEIT is an AI-powered construction pricing platform in beta.

${VOICE}

${STYLE_GUIDE}

Your output must strictly follow the brand voice and style guide above. Never break character. Never use forbidden words.`;

    const userPrompt = `${formatPrompt}

Target audience: ${icp.name}
Audience description: ${icp.description}
Their pain points: ${icp.pain_points.join(", ")}
Audience hook: ${icp.hook}
How to speak to them: ${icp.language}
${topic ? `\nFocus topic / angle: ${topic}` : ""}
${tone ? `\nTone emphasis: ${tone}` : ""}

Generate the content now. Output only the final content — no meta-commentary, no "here's your post:", just the content itself.`;

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
