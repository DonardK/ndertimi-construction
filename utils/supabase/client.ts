import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase-env";

export const createClient = () =>
  createBrowserClient(getSupabaseUrl()!, getSupabaseAnonKey()!);
