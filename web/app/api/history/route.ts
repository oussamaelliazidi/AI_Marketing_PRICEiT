import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HistoryItem {
  id:         string;
  type:       "generation" | "repurpose" | "seo";
  format:     string;
  voice:      string;
  segment:    string;
  content:    string;
  score:      number;
  word_count: number | null;
  topic:      string | null;
  created_at: string;
}

// ── GET /api/history ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured", items: [] },
      { status: 503 }
    );
  }

  const { searchParams } = req.nextUrl;
  const type    = searchParams.get("type")    ?? "all";   // all | generation | repurpose | seo
  const format  = searchParams.get("format")  ?? "";
  const segment = searchParams.get("segment") ?? "";
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const items: HistoryItem[] = [];

  // ── content_generations ────────────────────────────────────────────────
  if (type === "all" || type === "generation") {
    let q = admin
      .from("content_generations")
      .select("id, format, voice, segment, topic, content, quality_score, word_count, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (format)  q = q.eq("format", format);
    if (segment) q = q.eq("segment", segment);

    const { data, error } = await q;
    if (error) console.error("[history:content_generations]", error.message);
    if (data) {
      for (const row of data) {
        items.push({
          id:         row.id,
          type:       "generation",
          format:     row.format,
          voice:      row.voice,
          segment:    row.segment,
          content:    row.content,
          score:      row.quality_score ?? 0,
          word_count: row.word_count ?? null,
          topic:      row.topic ?? null,
          created_at: row.created_at,
        });
      }
    }
  }

  // ── content_repurposes ─────────────────────────────────────────────────
  if (type === "all" || type === "repurpose") {
    let q = admin
      .from("content_repurposes")
      .select("id, source_format, target_format, voice, segment, repurposed_content, quality_score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (format)  q = q.eq("target_format", format);
    if (segment) q = q.eq("segment", segment);

    const { data, error } = await q;
    if (error) console.error("[history:content_repurposes]", error.message);
    if (data) {
      for (const row of data) {
        const content = row.repurposed_content ?? "";
        items.push({
          id:         row.id,
          type:       "repurpose",
          format:     `${row.source_format} → ${row.target_format}`,
          voice:      row.voice,
          segment:    row.segment,
          content,
          score:      row.quality_score ?? 0,
          word_count: content.split(/\s+/).filter(Boolean).length,
          topic:      null,
          created_at: row.created_at,
        });
      }
    }
  }

  // ── seo_generations ────────────────────────────────────────────────────
  if (type === "all" || type === "seo") {
    let q = admin
      .from("seo_generations")
      .select("id, keyword, voice, segment, content, seo_score, word_count, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (segment) q = q.eq("segment", segment);

    const { data, error } = await q;
    if (error) console.error("[history:seo_generations]", error.message);
    if (data) {
      for (const row of data) {
        items.push({
          id:         row.id,
          type:       "seo",
          format:     "blog_post",
          voice:      row.voice,
          segment:    row.segment,
          content:    row.content,
          score:      row.seo_score ?? 0,
          word_count: row.word_count ?? null,
          topic:      row.keyword ?? null,
          created_at: row.created_at,
        });
      }
    }
  }

  // Sort all combined results by date desc
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return Response.json({ items: items.slice(0, limit) });
}
