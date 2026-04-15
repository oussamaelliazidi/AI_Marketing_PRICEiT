import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import feeds from "@/lib/feeds.json";
import { createRateLimiter } from "@/lib/rateLimit";
import { isValidSegment } from "@/lib/validateInput";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// ── Types ──────────────────────────────────────────────────────────────────

export interface MinedQuote {
  id: string;
  source: string;
  source_url: string;
  article_title: string;
  quote: string;
  topic_suggestion: string;
  segment: string;
  published_at: string | null;
}

// ── Module-level cache (6h TTL — resets on cold start) ────────────────────

let cache: { quotes: MinedQuote[]; fetchedAt: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

// ── RSS helpers ────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")
  );
  return m?.[1]?.trim() ?? "";
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml: string, limit = 3) {
  const items: Array<{ title: string; description: string; link: string; pubDate: string }> = [];
  const regex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) matches.push(m);
  for (const m of matches) {
    if (items.length >= limit) break;
    const block = m[1];
    const title   = cleanText(extractTag(block, "title"));
    const desc    = cleanText(extractTag(block, "description")).slice(0, 600);
    const link    = cleanText(extractTag(block, "link"));
    const pubDate = cleanText(extractTag(block, "pubDate") || extractTag(block, "published"));
    if (title && desc) items.push({ title, description: desc, link, pubDate });
  }
  return items;
}

// ── Groq: extract quotes + topic suggestions from articles ─────────────────

async function extractInsights(
  articles: Array<{ title: string; description: string; source: string }>,
  segment: string
): Promise<Array<{ quote: string; topic: string }>> {
  const list = articles
    .map((a, i) => `[${i + 1}] Source: ${a.source}\nTitle: ${a.title}\nContent: ${a.description}`)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1024,
    stream: false,
    messages: [
      {
        role: "system",
        content: `You extract contractor-relevant insights from construction news for PRICEIT — an AI construction pricing platform.
PRICEIT helps ${segment === "large_firm" ? "large construction firms cut estimating time by 60%" : "small contractors price any job in under 2 minutes"}.
Return ONLY a valid JSON array — no markdown, no commentary.`,
      },
      {
        role: "user",
        content: `For each article below, extract:
1. "quote": The most relevant sentence or stat from the content (1-2 sentences max, keep original wording where possible)
2. "topic": A PRICEIT content topic this article inspires (10-15 words, contractor language, no buzzwords)

Articles:
${list}

Return a JSON array with exactly ${articles.length} objects:
[{"quote":"...","topic":"..."},...]`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "[]";
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

// ── Fetch + mine all feeds ─────────────────────────────────────────────────

async function mineFeeds(): Promise<MinedQuote[]> {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "PRICEIT-Bot/1.0 (+https://priceit.io)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
      const xml = await res.text();
      return { feed, items: parseRssItems(xml, 5) };
    })
  );

  // Flatten all articles
  const allArticles: Array<{
    title: string;
    description: string;
    link: string;
    pubDate: string;
    source: string;
    segment: string;
  }> = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { feed, items } = r.value;
      for (const item of items) {
        allArticles.push({ ...item, source: feed.name, segment: feed.segment });
      }
    }
  }

  if (allArticles.length === 0) return [];

  // One Groq call for all articles
  const insights = await extractInsights(
    allArticles.map((a) => ({ title: a.title, description: a.description, source: a.source })),
    "both"
  );

  // Build MinedQuote objects with pre-generated UUIDs
  const quotes: MinedQuote[] = [];
  for (let i = 0; i < allArticles.length; i++) {
    const article = allArticles[i];
    const insight = insights[i];
    if (!insight?.quote || !insight?.topic) continue;

    quotes.push({
      id:               crypto.randomUUID(),
      source:           article.source,
      source_url:       article.link,
      article_title:    article.title,
      quote:            insight.quote,
      topic_suggestion: insight.topic,
      segment:          article.segment,
      published_at:     article.pubDate || null,
    });
  }

  // Save to Supabase (fire & forget — text + behavior only, no media)
  if (quotes.length > 0) {
    getSupabase()
      .from("mined_quotes")
      .insert(
        quotes.map((q) => ({
          id:               q.id,
          source:           q.source,
          source_url:       q.source_url,
          article_title:    q.article_title,
          quote:            q.quote,
          topic_suggestion: q.topic_suggestion,
          segment:          q.segment === "both" ? "unknown" : q.segment,
          published_at:     q.published_at,
        }))
      )
      .then(({ error }) => {
        if (error) console.error("[supabase:mined_quotes]", error.message);
      });
  }

  return quotes;
}

// ── GET /api/quotes ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  try {
    const rawSegment = req.nextUrl.searchParams.get("segment") ?? "all";
    const segment = rawSegment === "all" || isValidSegment(rawSegment) ? rawSegment : "all";
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";

    // Serve from cache if fresh
    const now = Date.now();
    if (!refresh && cache && now - cache.fetchedAt < CACHE_TTL) {
      const quotes =
        segment === "all"
          ? cache.quotes
          : cache.quotes.filter((q) => q.segment === segment || q.segment === "both");
      return Response.json(quotes);
    }

    // Fetch fresh
    const quotes = await mineFeeds();
    cache = { quotes, fetchedAt: now };

    const filtered =
      segment === "all"
        ? quotes
        : quotes.filter((q) => q.segment === segment || q.segment === "both");

    return Response.json(filtered);
  } catch (err: unknown) {
    console.error("[/api/quotes]", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "An internal error occurred. Please try again." },
      { status: 500 }
    );
  }
}
