/**
 * Input validation helpers for API routes.
 *
 * Centralises allowlists and length limits so every route
 * enforces the same rules.
 */

// ── Allowlists ──────────────────────────────────────────────────────────────

export const VALID_SEGMENTS = ["small_contractor", "large_firm"] as const;
export type ValidSegment = (typeof VALID_SEGMENTS)[number];

export const VALID_VOICES = ["street", "professional", "aggressive"] as const;
export type ValidVoice = (typeof VALID_VOICES)[number];

export const VALID_FORMATS = [
  "linkedin_post",
  "cold_email",
  "email_sequence",
  "blog_intro",
  "instagram",
  "x_post",
  "facebook_post",
  "whatsapp_message",
  "snapchat",
] as const;
export type ValidFormat = (typeof VALID_FORMATS)[number];

// ── Length limits (characters) ──────────────────────────────────────────────

export const MAX_TOPIC_LENGTH = 500;
export const MAX_KEYWORD_LENGTH = 200;
export const MAX_HEADLINE_LENGTH = 500;
export const MAX_CONTENT_LENGTH = 10_000;
export const MAX_PAGE_CONTENT_LENGTH = 20_000;
export const MAX_PAGE_URL_LENGTH = 2_000;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isValidSegment(value: unknown): value is ValidSegment {
  return typeof value === "string" && (VALID_SEGMENTS as readonly string[]).includes(value);
}

export function isValidVoice(value: unknown): value is ValidVoice {
  return typeof value === "string" && (VALID_VOICES as readonly string[]).includes(value);
}

export function isValidFormat(value: unknown): value is ValidFormat {
  return typeof value === "string" && (VALID_FORMATS as readonly string[]).includes(value);
}

/**
 * Truncate a string to a maximum length. Returns the original
 * string if it's within limits, or the truncated version.
 */
export function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Returns a 400 Response if the value exceeds the max length.
 * Returns null if valid.
 */
export function checkLength(
  fieldName: string,
  value: string | undefined | null,
  max: number
): Response | null {
  if (value != null && typeof value !== "string") {
    return new Response(
      JSON.stringify({ error: `${fieldName} must be a string` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (value && value.length > max) {
    return new Response(
      JSON.stringify({ error: `${fieldName} exceeds maximum length of ${max} characters` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
