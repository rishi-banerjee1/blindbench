/**
 * submit-vote Edge Function
 *
 * Handles vote submission server-side with:
 *   - Input validation (prompt_id UUID, winner_model string)
 *   - Rate limiting (5 votes/min per IP)
 *   - IP hashing (SHA-256, raw IP never stored)
 *   - Writes via service role (anon INSERT revoked on votes table)
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, hashIp } from "../_shared/rate-limit.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { prompt_id, winner_model } = body;

    // ── Validate input ──────────────────────────────────────
    if (!prompt_id || typeof prompt_id !== "string" || !UUID_REGEX.test(prompt_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing prompt_id (UUID required)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!winner_model || typeof winner_model !== "string" || winner_model.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing winner_model." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap model name length to prevent abuse
    if (winner_model.length > 200) {
      return new Response(
        JSON.stringify({ error: "winner_model exceeds maximum length." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Rate limiting ───────────────────────────────────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIp(clientIp);

    const rateLimit = await checkRateLimit(ipHash, "submit-vote");
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait before voting again.",
          remaining: rateLimit.remaining,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Insert vote via service role ────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: insertError } = await supabase.from("votes").insert({
      prompt_id,
      winner_model: winner_model.trim(),
      ip_hash: ipHash,
    });

    if (insertError) {
      console.error("Vote insert failed:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to submit vote." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("submit-vote error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
