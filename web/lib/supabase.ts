import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton Supabase client — reuse across requests to avoid resource leaks.
// Previously, createClient() was called on every request, which leaked
// GoTrue/Realtime instances and caused unnecessary overhead.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    _client = createClient(url, key);
  }
  return _client;
}
