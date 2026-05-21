import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient();
  }
  return _client;
}
