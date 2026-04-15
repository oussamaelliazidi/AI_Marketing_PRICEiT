import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { scoreContent } from "@/lib/contentScorer";
import { VoiceType, VOICE_PROMPTS } from "@/lib/voices";
import { getSupabase } from "@/lib/supabase";
import { createRateLimiter } from "@/lib/rateLimit";
import {
  isValidFormat,
  isValidVoice,
  isValidSegment,
  checkLength,
  MAX_CONTENT_LENGTH,
} from "@/lib/validateInput";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

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

  email_sequence: `3-email cold outreach sequence. Each email must be complete and standalone.

EMAIL 1 — Day 0 (Cold intro)
Subject line (under 50 chars) → 3-4 sentences leading with the pain → one clear CTA → sign-off. 100-130 words.

EMAIL 2 — Day 3 (Follow-up)
Subject line → specific result or stat → 3-4 sentences from a different angle → one CTA → sign-off. 100-130 words.

EMAIL 3 — Day 7 (Final touch)
Subject line → genuine insight or tip OR a clean breakup line → 3-4 sentences → sign-off. 80-100 words.

Label each: "EMAIL 1 — Day 0", "EMAIL 2 — Day 3", "EMAIL 3 — Day 7".
No "I hope this finds you well". Sign off: [First name], PRICEIT
Total: 280-360 words.`,

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
  const limited = limiter.check(req);
  if (limited) return limited;

  try {
    const { content, sourceFormat, targetFormat, segment, voice } = await req.json();

    if (!content || !targetFormat) {
      return new Response(
        JSON.stringify({ error: "content and targetFormat are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const lengthErr = checkLength("content", content, MAX_CONTENT_LENGTH);
    if (lengthErr) return lengthErr;

    if (!isValidFormat(targetFormat)) {
      return new Response(
        JSON.stringify({ error: "Invalid target format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetInstructions = FORMAT_INSTRUCTIONS[targetFormat];
    if (!targetInstructions) {
      return new Response(
        JSON.stringify({ error: "Unsupported format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sourceLabel = FORMAT_LABELS[sourceFormat] ?? sourceFormat;
    const targetLabel = FORMAT_LABELS[targetFormat] ?? targetFormat;

    const voiceKey: VoiceType = isValidVoice(voice) ? voice : "street";
    const safeSegment = isValidSegment(segment) ? segment : "unknown";
    const systemPrompt = `You repurpose marketing content for PRICEIT — an AI construction pricing platform.

PRICEIT lets contractors price any job in under 2 minutes.

${VOICE_PROMPTS[voiceKey]}

Additional repurpose rule: Keep the same story, characters, and numbers from the source — don't invent new facts. Reshape structure and length to fit the target platform.`;

    const userPrompt = `Here is a ${sourceLabel} for a ${safeSegment === "large_firm" ? "large construction firm" : "small contractor"} audience:

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
        max_tokens: targetFormat === "email_sequence" ? 2048 : 1024,
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

    // ── Save to Supabase for AI training (fire & forget) ───────────────────
    getSupabase()
      .from("content_repurposes")
      .insert({
        source_format:      sourceFormat  || "unknown",
        target_format:      targetFormat,
        source_content:     content,
        repurposed_content: bestContent,
        voice:              voiceKey,
        segment:            safeSegment,
        quality_score:      bestScore,
      })
      .then(({ error }) => {
        if (error) console.error("[supabase:content_repurposes]", error.message);
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
        "X-Quality-Score": String(bestScore),
      },
    });
  } catch (err: unknown) {
    console.error("[/api/repurpose]", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
