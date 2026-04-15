import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createRateLimiter } from "@/lib/rateLimit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

// POST /api/quotes/use
// Body: { id: string }
// Marks a mined quote as used (behavioral signal for AI training)

export async function POST(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  try {
    const { id } = await req.json();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    // Fire & forget — RLS allows anon UPDATE on mined_quotes
    getSupabase()
      .from("mined_quotes")
      .update({ used_as_topic: true, used_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[supabase:mined_quotes:use]", error.message);
      });

    return Response.json({ ok: true });
  } catch (err: unknown) {
    console.error("[/api/quotes/use]", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "An internal error occurred. Please try again." },
      { status: 500 }
    );
  }
}
