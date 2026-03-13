/**
 * Supabase client — uses ONLY the public anon key.
 * All LLM API calls go through Supabase Edge Functions.
 * The frontend NEVER has access to OpenAI/Anthropic API keys.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
