/**
 * Content Quality Scorer — TypeScript port of content-quality-scorer.py
 * Five scoring dimensions: voice similarity, specificity, AI slop, length, engagement.
 * Threshold: 62 for PRICEIT (intentional — not a regression from the Python default of 60).
 *
 * Format groups:
 *   short  — x_post, snapchat, whatsapp_message  (under 300 chars / 100 words)
 *   medium — instagram, facebook_post, cold_email (100–300 words)
 *   long   — linkedin_post, email_sequence, blog_intro (150–800 words)
 *
 * Short formats use lower thresholds and adjusted weights.
 * Voice scoring is normalised by content length so short formats aren't penalised
 * for not fitting contractor names + numbers that simply don't fit in 280 chars.
 */

export const QUALITY_THRESHOLD = 62;

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
  /we are pleased to announce/i,
  /stay tuned for more/i,
];

// ── Voice markers ───────────────────────────────────────────────────────────

const VOICE_MARKERS: [RegExp, number, string][] = [
  // Money — strongest signal for contractor content
  [/\$[\d,]+[KkMmBb]?(?:\+)?/g, 2.5, "revenue_markers"],
  [/\d+%/g, 1.5, "percentage_stats"],
  [/\d+x/g, 1.5, "multiplier_stats"],
  // Time specificity — job timelines are very PRICEIT
  [/\d+ (?:hours?|minutes?|days?|weeks?|months?|years?)/gi, 1.5, "time_specifics"],
  // Contractor story patterns — 3rd person narrative
  [/(?:Mike|Dave|Carlos|Tony|Ray|Luis|Joe|Marco|Pete)\b/g, 2.0, "contractor_names"],
  [/won (?:a |the )?(?:job|bid|contract)|lost (?:a |the )?(?:job|bid|contract)/gi, 2.0, "bid_outcome"],
  [/quoted?|bid|estimate[d]?|price[d]?/gi, 1.0, "pricing_language"],
  [/job site|roofing|plumbing|electrical|drywall|concrete|contractor|GC\b/gi, 1.0, "trade_language"],
  // Direct address
  [/\bYou(?:'re| are| were| don't| can't| won't| have)\b/g, 1.5, "direct_address"],
  // Contrarian / hook patterns
  [/Most people .{1,50} wrong|Everyone says .{1,30} That's/gi, 2.0, "contrarian_hooks"],
  [/Harsh reality:|Here's the truth:|The problem:/gi, 1.5, "tension_hooks"],
  // Engagement
  [/What's your take\?|What did I miss\?|What would you do|Sound familiar/gi, 1.0, "engagement_cta"],
  // Short punchy sentences
  [/[.!?]\s+[A-Z][^.!?]{1,75}[.!?]/g, 0.5, "short_sentences"],
];

// ── Platform limits (char counts) ───────────────────────────────────────────

const PLATFORM_LIMITS: Record<string, { min: number; max: number; optMin: number; optMax: number }> = {
  x:            { min: 50,  max: 280,  optMin: 120, optMax: 260 },
  snapchat:     { min: 50,  max: 350,  optMin: 80,  optMax: 300 },  // caption (≤50) + 2-line blurb
  whatsapp:     { min: 80,  max: 700,  optMin: 150, optMax: 600 },  // under 100 words
  linkedin:     { min: 200, max: 1500, optMin: 500, optMax: 1200 },
  instagram:    { min: 100, max: 800,  optMin: 200, optMax: 600 },
  facebook:     { min: 100, max: 1200, optMin: 300, optMax: 900 },
  email:        { min: 100, max: 800,  optMin: 200, optMax: 600 },
  newsletter:   { min: 300, max: 2000, optMin: 800, optMax: 1600 },
  blog:         { min: 300, max: 2000, optMin: 500, optMax: 1500 },
};

// Map content-engine format IDs → platform keys
const FORMAT_TO_PLATFORM: Record<string, string> = {
  linkedin_post:    "linkedin",
  x_post:           "x",
  instagram:        "instagram",
  cold_email:       "email",
  email_sequence:   "newsletter",
  blog_intro:       "blog",
  facebook_post:    "facebook",
  whatsapp_message: "whatsapp",
  snapchat:         "snapchat",
};

// ── Format groups — controls weights + threshold per group ───────────────────

type FormatGroup = "short" | "medium" | "long";

const FORMAT_GROUP: Record<string, FormatGroup> = {
  x_post:           "short",
  snapchat:         "short",
  whatsapp_message: "short",
  instagram:        "medium",
  facebook_post:    "medium",
  cold_email:       "medium",
  linkedin_post:    "long",
  email_sequence:   "long",
  blog_intro:       "long",
};

// Per-group thresholds — short formats pass easier (can't fit all signals in 280 chars)
const GROUP_THRESHOLD: Record<FormatGroup, number> = {
  short:  48,
  medium: 58,
  long:   62,
};

// Per-group weights
const GROUP_WEIGHTS: Record<FormatGroup, typeof WEIGHTS_DEFAULT> = {
  short: {
    // Short formats: slop-free + right length = pass. Voice/specificity are hard at 280 chars.
    voice_similarity:       0.15,
    specificity:            0.10,
    slop_penalty:           0.40,
    length_appropriateness: 0.25,
    engagement_potential:   0.10,
  },
  medium: {
    voice_similarity:       0.30,
    specificity:            0.25,
    slop_penalty:           0.25,
    length_appropriateness: 0.10,
    engagement_potential:   0.10,
  },
  long: {
    voice_similarity:       0.35,
    specificity:            0.25,
    slop_penalty:           0.20,
    length_appropriateness: 0.10,
    engagement_potential:   0.10,
  },
};

// ── Default weights (used as type reference) ─────────────────────────────────

const WEIGHTS_DEFAULT = {
  voice_similarity:       0.35,
  specificity:            0.25,
  slop_penalty:           0.20,
  length_appropriateness: 0.10,
  engagement_potential:   0.10,
};

// Keep WEIGHTS for backwards compat — long group is the "standard"
const WEIGHTS = GROUP_WEIGHTS.long;

// ── Scoring functions ───────────────────────────────────────────────────────

function scoreVoiceSimilarity(text: string, group: FormatGroup = "long"): number {
  let score = 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Normalisation factor: short content can't fit as many signals.
  // A single $45K in a 30-word tweet should score as well as 3 in a 200-word post.
  const lengthNorm = group === "short" ? 3.0 : group === "medium" ? 1.5 : 1.0;

  for (const [pattern, weight] of VOICE_MARKERS) {
    const matches = text.match(pattern);
    if (matches) {
      const count = matches.length;
      const catScore = Math.min(weight * Math.log(count + 1) * 10 * lengthNorm, weight * 25);
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

  // For short formats: reward density over total count
  if (group === "short" && wordCount > 0) {
    const densityBonus = Math.min((score / wordCount) * 5, 20);
    score += densityBonus;
  }

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
  const platform  = FORMAT_TO_PLATFORM[format] ?? "x";
  const group     = FORMAT_GROUP[format] ?? "long";
  const weights   = GROUP_WEIGHTS[group];
  const threshold = GROUP_THRESHOLD[group];

  const voice       = scoreVoiceSimilarity(text, group);
  const specificity = scoreSpecificity(text);
  const { score: slop, issues: slopIssues } = scoreSlopPenalty(text);
  const length      = scoreLengthAppropriateness(text, platform);
  const engagement  = scoreEngagementPotential(text, platform);

  const total = Math.round(
    voice       * weights.voice_similarity +
    specificity * weights.specificity +
    slop        * weights.slop_penalty +
    length      * weights.length_appropriateness +
    engagement  * weights.engagement_potential
  );

  // Thresholds are group-aware — short formats pass at 48, medium at 58, long at 62
  const voiceThreshold      = group === "short" ? 30 : 50;
  const specificityThreshold = group === "short" ? 15 : 40;
  const lengthThreshold      = group === "short" ? 40 : 60;
  const engagementThreshold  = group === "short" ? 20 : 40;

  const issues: string[] = [];
  if (voice < voiceThreshold)           issues.push("Weak brand voice");
  if (specificity < specificityThreshold) issues.push("Needs more specific numbers/examples");
  if (slop < 70)                        issues.push(...slopIssues);
  if (length < lengthThreshold)         issues.push(`Length off for ${platform}`);
  if (engagement < engagementThreshold) issues.push("Weak hook/CTA");

  return {
    total,
    breakdown: { voice, specificity, slop, length, engagement },
    passed: total >= threshold,
    issues,
  };
}
