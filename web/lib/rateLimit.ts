/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding-window counter per IP. State resets on cold start
 * (acceptable for Vercel serverless — persistent stores like Redis
 * can be added later if needed).
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   // inside route handler:
 *   const blocked = limiter.check(ip);
 *   if (blocked) return blocked;  // returns a 429 Response
 */

import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window per IP */
  max: number;
}

interface RateLimiter {
  /**
   * Check whether the request should be rate-limited.
   * Returns a 429 Response if blocked, or null if allowed.
   */
  check: (req: NextRequest) => Response | null;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const map = new Map<string, RateLimitEntry>();

  // Periodically purge expired entries to prevent memory leaks.
  // Runs every 60 s; safe for serverless because the interval is
  // tied to the module-level singleton and dies with the isolate.
  const CLEANUP_INTERVAL = 60_000;
  setInterval(() => {
    const now = Date.now();
    map.forEach((entry, key) => {
      if (now >= entry.resetAt) map.delete(key);
    });
  }, CLEANUP_INTERVAL).unref();

  function getIp(req: NextRequest): string {
    return (
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    );
  }

  return {
    check(req: NextRequest): Response | null {
      const ip = getIp(req);
      const now = Date.now();
      const entry = map.get(ip);

      if (!entry || now >= entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + opts.windowMs });
        return null;
      }

      entry.count++;
      if (entry.count > opts.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }
        );
      }

      return null;
    },
  };
}
