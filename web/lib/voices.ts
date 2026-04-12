/**
 * PRICEIT Voice System — 3 distinct writing personalities.
 * Used by both /api/generate and /api/repurpose routes.
 */

export type VoiceType = "street" | "professional" | "aggressive";

export interface VoiceOption {
  id: VoiceType;
  label: string;
  tagline: string;
  description: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: "street",
    label: "Street",
    tagline: "Contractor to contractor",
    description: "Story-driven, job site language, real names and numbers",
  },
  {
    id: "professional",
    label: "Professional",
    tagline: "Business owner to business owner",
    description: "Data-led, process-focused, polished but human",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    tagline: "Straight to the pain",
    description: "Short, punchy, urgency-first — built for cold outreach",
  },
];

export const VOICE_PROMPTS: Record<VoiceType, string> = {
  street: `
VOICE: STREET — Contractor talking to another contractor.
Blue-collar, direct, story-driven. You've been on job sites. You know what a $45K roofing job feels like.

Rules:
- Sound like a real person — short sentences, plain words, zero fluff
- Tell a story. Name a person (Mike, Dave, Carlos, Tony, Ray, Luis, Joe, Marco, Pete). Give them a real situation.
- Use specific numbers: $45K, 3 days, 60%, 8 minutes — never round or vague
- Never end with a product claim. End with a human outcome, then mention PRICEIT quietly.
- Never use: "leverage", "game-changer", "revolutionary", "in today's world", "pricing solution"
- PRICEIT always in all caps`,

  professional: `
VOICE: PROFESSIONAL — Sharp business owner presenting to other business owners.
Data-driven, process-focused, confident. No slang, but still human — never robotic or corporate.

Rules:
- Lead with a business outcome or metric: time saved, margin protected, bids won
- Use structured thinking: clear problem → clear solution → clear result
- Sentences max 20 words — punchy but complete
- No job site slang, no corporate buzzwords
- Numbers and stats are mandatory — vague claims don't exist in this voice
- Never use: "leverage", "synergy", "end-to-end solution", "best-in-class", "world-class"
- PRICEIT always in all caps`,

  aggressive: `
VOICE: AGGRESSIVE — A closer. Every sentence earns its place or gets cut.
Cold email, WhatsApp, paid ad territory. No story. Straight to the pain, straight to the fix.

Rules:
- First sentence must hit a pain point hard — no warm-up, no context
- Maximum 3–4 sentences per paragraph. Often just 1–2.
- Use dollar amounts and time lost to make the pain real: "That's $8K left on the table. Every week."
- Create urgency without begging: beta spots, limited access, competitors already using it
- End with ONE clear action — no options, no soft CTAs
- Never use: "I hope this finds you well", "just following up", "when you get a chance"
- PRICEIT always in all caps`,
};
