import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./supabase-env";

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (!_client) {
    const { url, key } = requireSupabaseConfig();
    _client = createBrowserClient(url, key);
  }
  return _client;
}
