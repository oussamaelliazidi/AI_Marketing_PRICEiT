/**
 * Server-side only Supabase admin client.
 * Uses the service_role key — bypasses RLS so we can SELECT training data.
 *
 * NEVER import this in client components or expose to the browser.
 * Only used in /api/* route handlers.
 *
 * To enable: add SUPABASE_SERVICE_ROLE_KEY to .env.local
 * Get it from: Supabase dashboard → Settings → API → service_role (secret)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  return adminClient;
}
