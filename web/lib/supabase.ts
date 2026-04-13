import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (uses anon key — RLS handles access control)
export function getSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
