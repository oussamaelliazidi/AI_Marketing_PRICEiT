/**
 * Content Quality Scorer — TypeScript port of content-quality-scorer.py
 * Five scoring dimensions: voice similarity, specificity, AI slop, length, engagement.
 * Threshold: 70 for PRICEIT (stricter than the Python default of 60)
 */

export const QUALITY_THRESHOLD = 70;

// ── Banned words (AI slop) ──────────────────────────────────────────────────

const BANNED_WORDS = [
  "leverage", "synergy", "ecosystem", "holistic", "at the end of the day",
  "delve", "tapestry", "landscape", "multifaceted", "nuanced", "pivotal",
  "realm", "robust", "seamless", "testament", "transformative", "underscore",
  "utilize", "whilst", "keen", "embark", "comprehensive", "intricate",
  "commendable", "meticulous", "paramount", "groundbreaking", "innovative",
  "cutting-edge", "paradigm", "crucial", "enduring",
  "enhance", "fostering", "garner", "highlight", "interplay", "intricacies",
  "showcase", "vibrant", "valuable", "profound", "renowned", "breathtaking",
  "nestled", "stunning", "I'm excited to share", "I think maybe",
  "It could potentially", "dive into", "game-changer", "unlock",
  // PRICEIT extras
  "revolutionary", "world-class", "best-in-class", "end-to-end solution",
  "pricing solution", "in today's world", "it's no secret",
];

// ── AI pattern regexes ──────────────────────────────────────────────────────

const AI_PATTERNS: [RegExp, string][] = [
  [/pivotal moment|is a testament|stands as/i, "significance_inflation"],
  [/boasts|vibrant|commitment to/i, "promotional_language"],
  [/experts believe|industry reports|studies show/i, "vague_attribution"],
  [/despite.{1,50}continues to/i, "formulaic_structure"],
  [/serves as|acts as|functions as/i, "copula_avoidance"],
  [/it's not just .{1,30}, it's/i, "negative_parallelism"],
  [/could potentially|might possibly|may perhaps/i, "excessive_hedging"],
  [/the future looks bright|exciting times ahead|stay tuned/i, "generic_conclusion"],
];

const CORPORATE_PATTERNS: RegExp[] = [
  /I'm excited to share/i,
  /it is important to note/i,
  /in order to/i,
  /we are pleased to announce/i,
  /stay tuned for/i,
];

// ── Voice markers ───────────────────────────────────────────────────────────

const VOICE_MARKERS: [RegExp, number, string][] = [
  [/\$[\d,]+[KkMmBb]?(?:\+)?/g, 2.0, "revenue_markers"],
  [/\d+%/g, 1.5, "percentage_stats"],
  [/\d+x/g, 1.5, "multiplier_stats"],
  [/\d+ (?:hours?|minutes?|days?|weeks?|months?|years?)/gi, 1.0, "time_specifics"],
  [/\d+ (?:pages?|pieces?|tools?|agents?|companies|founders?|members)/gi, 1.0, "count_specifics"],
  [/I (?:built|found|asked|remember|had lunch)/g, 2.0, "personal_framing"],
  [/Here's what happened|A friend who|I asked \d+/gi, 1.5, "story_framing"],
  [/Most people .{1,50} wrong|Everyone says .{1,30} That's/gi, 2.0, "contrarian_hooks"],
  [/Harsh reality:/gi, 1.5, "harsh_reality"],
  [/What's your take\?|What did I miss\?|What would you do/gi, 1.0, "engagement_cta"],
  [/[.!?]\s+[A-Z][^.!?]{1,75}[.!?]/g, 0.5, "short_sentences"],
];

// ── Platform limits ─────────────────────────────────────────────────────────

const PLATFORM_LIMITS: Record<string, { min: number; max: number; optMin: number; optMax: number }> = {
  x:            { min: 50,  max: 280,  optMin: 150, optMax: 260 },
  linkedin:     { min: 200, max: 1500, optMin: 500, optMax: 1200 },
  instagram:    { min: 100, max: 800,  optMin: 200, optMax: 600 },
  email:        { min: 100, max: 800,  optMin: 200, optMax: 600 },
  newsletter:   { min: 300, max: 2000, optMin: 800, optMax: 1600 },
  blog:         { min: 300, max: 2000, optMin: 500, optMax: 1500 },
};

// Map content-engine format IDs → platform keys
const FORMAT_TO_PLATFORM: Record<string, string> = {
  linkedin_post:   "linkedin",
  x_post:          "x",
  instagram:       "instagram",
  cold_email:      "email",
  email_sequence:  "newsletter",
  blog_intro:      "blog",
  facebook_post:   "instagram",
  whatsapp_message:"email",
  snapchat:        "instagram",
};

// ── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  voice_similarity:       0.35,
  specificity:            0.25,
  slop_penalty:           0.20,
  length_appropriateness: 0.10,
  engagement_potential:   0.10,
};

// ── Scoring functions ───────────────────────────────────────────────────────

function scoreVoiceSimilarity(text: string): number {
  let score = 0;

  for (const [pattern, weight] of VOICE_MARKERS) {
    const matches = text.match(pattern);
    if (matches) {
      const count = matches.length;
      const catScore = Math.min(weight * Math.log(count + 1) * 10, weight * 25);
      score += catScore;
    }
  }

  // Short punchy sentence bonus
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const short = sentences.filter((s) => {
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.length >= 3 && words.length <= 15;
  });
  const ratio = short.length / Math.max(sentences.length, 1);
  score += ratio * 15;

  return Math.min(score, 100);
}

function scoreSpecificity(text: string): number {
  let score = 0;

  const numberPatterns: RegExp[] = [
    /\$[\d,]+[KkMmBb]?(?:\+)?/g,
    /\d+%/g,
    /\d+x/g,
    /\d+[\.,]?\d*\s*(?:hours?|minutes?|days?|weeks?|months?|years?)/gi,
    /\d+\s*(?:pages?|pieces?|tools?|agents?|companies|founders?|members)/gi,
  ];

  let totalNumbers = 0;
  for (const pattern of numberPatterns) {
    const m = text.match(pattern);
    if (m) totalNumbers += m.length;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const density = totalNumbers / Math.max(wordCount / 50, 1);
  score += Math.min(density * 30, 50);

  // Named entity patterns (simple heuristic)
  const entityPatterns: RegExp[] = [
    /[A-Z][a-z]+ [A-Z][a-z]+/g,
    /@[A-Za-z0-9_]+/g,
  ];
  let entityCount = 0;
  for (const pattern of entityPatterns) {
    const m = text.match(pattern);
    if (m) entityCount += m.length;
  }
  score += Math.min(entityCount * 10, 30);

  // Before/after comparisons
  const comparisonPatterns: RegExp[] = [
    /\d+.*→.*\d+/,
    /from \d+.*to \d+/i,
    /before.*\d+.*after.*\d+/i,
    /used to.*now.*/i,
  ];
  for (const pattern of comparisonPatterns) {
    if (pattern.test(text)) {
      score += 10;
      break;
    }
  }

  return Math.min(score, 100);
}

function scoreSlopPenalty(text: string): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  const lower = text.toLowerCase();

  const bannedFound: string[] = [];
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      bannedFound.push(word);
      score -= 10;
    }
  }
  if (bannedFound.length > 0) {
    issues.push(`Banned words: ${bannedFound.slice(0, 3).join(", ")}`);
  }

  const aiFound: string[] = [];
  for (const [pattern, name] of AI_PATTERNS) {
    if (pattern.test(text)) {
      aiFound.push(name);
      score -= 8;
    }
  }
  if (aiFound.length > 0) {
    issues.push(`AI patterns: ${aiFound.slice(0, 3).join(", ")}`);
  }

  // Em dash overuse
  const emDashCount = (text.match(/—/g) || []).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (emDashCount > wordCount / 200) {
    score -= 5;
    issues.push("Excessive em dash usage");
  }

  // Corporate speak
  for (const pattern of CORPORATE_PATTERNS) {
    if (pattern.test(text)) {
      score -= 15;
      issues.push("Corporate speak detected");
      break;
    }
  }

  return { score: Math.max(score, 0), issues };
}

function scoreLengthAppropriateness(text: string, platform: string): number {
  const charCount = text.length;
  const limits = PLATFORM_LIMITS[platform] ?? PLATFORM_LIMITS.x;

  if (charCount < limits.min) {
    return Math.max((charCount / limits.min) * 100, 20);
  }
  if (charCount > limits.max) {
    return Math.max((limits.max / charCount) * 100, 30);
  }
  if (charCount >= limits.optMin && charCount <= limits.optMax) {
    return 100;
  }
  return 85;
}

function scoreEngagementPotential(text: string, platform: string): number {
  let score = 0;

  const ctaPatterns: Record<string, RegExp[]> = {
    x:         [/What's your take\?/i, /What did I miss\?/i, /Reply with/i],
    linkedin:  [/What would you do/i, /What do you think/i, /Drop .* below/i, /curious.*your/i],
    instagram: [/Comment.*and I'll/i, /Follow for more/i],
    email:     [/reply to this/i, /let me know/i],
    newsletter:[/subscribe/i, /read more/i, /check it out/i],
    blog:      [/subscribe/i, /join.*beta/i, /waitlist/i],
  };

  const platformCTAs = ctaPatterns[platform] ?? ctaPatterns.x;
  for (const pattern of platformCTAs) {
    if (pattern.test(text)) {
      score += 25;
      break;
    }
  }

  // Strong hook (first 100 chars)
  const hook = text.slice(0, 100);
  const hookPatterns: RegExp[] = [
    /^\d+.*\./,
    /^Most people.*wrong/i,
    /^I (?:built|found|asked)/i,
    /^Harsh reality:/i,
    /^Here's what/i,
  ];
  for (const pattern of hookPatterns) {
    if (pattern.test(hook)) {
      score += 25;
      break;
    }
  }

  // Questions
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 1) {
    score += Math.min(questionCount * 15, 30);
  }

  // Debate invitation
  const debatePatterns: RegExp[] = [
    /Agree or disagree/i,
    /What's your experience/i,
    /Change my mind/i,
  ];
  for (const pattern of debatePatterns) {
    if (pattern.test(text)) {
      score += 20;
      break;
    }
  }

  return Math.min(score, 100);
}

// ── Main export ─────────────────────────────────────────────────────────────

export interface ScoreResult {
  total: number;
  breakdown: {
    voice: number;
    specificity: number;
    slop: number;
    length: number;
    engagement: number;
  };
  passed: boolean;
  issues: string[];
}

export function scoreContent(text: string, format: string): ScoreResult {
  const platform = FORMAT_TO_PLATFORM[format] ?? "x";

  const voice       = scoreVoiceSimilarity(text);
  const specificity = scoreSpecificity(text);
  const { score: slop, issues: slopIssues } = scoreSlopPenalty(text);
  const length      = scoreLengthAppropriateness(text, platform);
  const engagement  = scoreEngagementPotential(text, platform);

  const total = Math.round(
    voice       * WEIGHTS.voice_similarity +
    specificity * WEIGHTS.specificity +
    slop        * WEIGHTS.slop_penalty +
    length      * WEIGHTS.length_appropriateness +
    engagement  * WEIGHTS.engagement_potential
  );

  const issues: string[] = [];
  if (voice < 50)       issues.push("Weak brand voice");
  if (specificity < 40) issues.push("Needs more specific numbers/examples");
  if (slop < 70)        issues.push(...slopIssues);
  if (length < 60)      issues.push(`Length off for ${platform}`);
  if (engagement < 40)  issues.push("Weak hook/CTA");

  return {
    total,
    breakdown: { voice, specificity, slop, length, engagement },
    passed: total >= QUALITY_THRESHOLD,
    issues,
  };
}
