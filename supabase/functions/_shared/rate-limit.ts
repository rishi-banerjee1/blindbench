/**
 * Rate limiting via Supabase Postgres.
 * Max 5 requests per minute per hashed IP per endpoint.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_REQUESTS_PER_MINUTE = 5;

/**
 * Hash an IP address using SHA-256.
 * Never stores raw IP addresses.
 */
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check and increment rate limit for a given IP hash and endpoint.
 * Returns { allowed: boolean, remaining: number }.
 */
export async function checkRateLimit(
  ipHash: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const windowStart = new Date();
  windowStart.setSeconds(0, 0); // Truncate to current minute

  // Try to upsert the rate limit counter
  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_ip_hash: ipHash,
    p_endpoint: endpoint,
    p_window_start: windowStart.toISOString(),
    p_max_requests: MAX_REQUESTS_PER_MINUTE,
  });

  if (error) {
    // On error, fail open but log it — don't block users due to DB issues
    console.error("Rate limit check failed:", error.message);
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE };
  }

  const count = data as number;
  const allowed = count <= MAX_REQUESTS_PER_MINUTE;
  const remaining = Math.max(0, MAX_REQUESTS_PER_MINUTE - count);

  return { allowed, remaining };
}
