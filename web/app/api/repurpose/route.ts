import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { scoreContent } from "@/lib/contentScorer";
import { VoiceType, VOICE_PROMPTS } from "@/lib/voices";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Format instructions (same voice rules, different shape) ────────────────

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  linkedin_post: `LinkedIn post. Hook (1-2 lines) → conflict → turning point → outcome → 1-line CTA to PRICEIT beta.
150-250 words. Line breaks between paragraphs. No hashtags.`,

  x_post: `Single tweet. Under 280 characters. One punchy idea pulled from the story. 0-1 hashtag.`,

  instagram: `Instagram caption.
Structure: micro-story in 4-6 short lines (one sentence each) → blank line → lesson in 1-2 lines → blank line → soft PRICEIT mention → blank line → 2-3 hashtags: #contractor #constructiontech #estimating
Max 120 words. No emojis. No exclamation marks.`,

  cold_email: `Cold outreach email.
Subject line (under 50 chars) → blank line → 3-4 sentences max → one CTA.
No "I hope this finds you well". Sign off: [First name], PRICEIT`,

  email_sequence: `3-email cold outreach sequence.
Email 1 (Day 0): Lead with the pain. Short. One ask.
Email 2 (Day 3): One specific result or stat. Different angle.
Email 3 (Day 7): Add value or a clean breakup line.
Each email: Subject + body + sign-off. Under 80 words each.`,

  blog_intro: `Blog post opening.
H1 headline (under 60 chars) → 2-sentence intro (open with pain or stat) → first subhead → first body paragraph (100 words max).
End with a soft CTA to the PRICEIT beta waitlist.`,

  facebook_post: `Facebook post for a construction audience.
Hook (1-2 lines) → relatable story → what changed → soft CTA.
100-200 words. Conversational. 1-2 hashtags max.`,

  whatsapp_message: `WhatsApp message for contractor referral/outreach.
Under 100 words. Sound like a text from a colleague, not a sales pitch. No subject line.`,

  snapchat: `Snapchat caption (under 50 chars) + a 2-line context blurb.
Caption: punchy, visual, under 50 chars. Context: 1-2 short lines. No hashtags.`,
};

const FORMAT_LABELS: Record<string, string> = {
  linkedin_post:    "LinkedIn Post",
  x_post:           "X Post",
  instagram:        "Instagram",
  cold_email:       "Cold Email",
  email_sequence:   "Email Sequence",
  blog_intro:       "Blog Intro",
  facebook_post:    "Facebook Post",
  whatsapp_message: "WhatsApp",
  snapchat:         "Snapchat",
};

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { content, sourceFormat, targetFormat, segment, voice } = await req.json();

    if (!content || !targetFormat) {
      return new Response(
        JSON.stringify({ error: "content and targetFormat are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetInstructions = FORMAT_INSTRUCTIONS[targetFormat];
    if (!targetInstructions) {
      return new Response(
        JSON.stringify({ error: `Unknown format: ${targetFormat}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sourceLabel = FORMAT_LABELS[sourceFormat] ?? sourceFormat;
    const targetLabel = FORMAT_LABELS[targetFormat] ?? targetFormat;

    const voiceKey = (voice as VoiceType) || "street";
    const systemPrompt = `You repurpose marketing content for PRICEIT — an AI construction pricing platform.

PRICEIT lets contractors price any job in under 2 minutes.

${VOICE_PROMPTS[voiceKey]}

Additional repurpose rule: Keep the same story, characters, and numbers from the source — don't invent new facts. Reshape structure and length to fit the target platform.`;

    const userPrompt = `Here is a ${sourceLabel} for a ${segment === "large_firm" ? "large construction firm" : "small contractor"} audience:

---
${content}
---

Transform it into a ${targetLabel}.

${targetInstructions}

Write it now.`;

    const MAX_ATTEMPTS = 3;
    let bestContent = "";
    let bestScore = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const completion = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const generated = completion.choices[0]?.message?.content ?? "";
      const result = scoreContent(generated, targetFormat);

      if (result.total > bestScore) {
        bestScore = result.total;
        bestContent = generated;
      }

      if (result.passed) break;
    }

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(bestContent));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Quality-Score": String(bestScore),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/repurpose]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
