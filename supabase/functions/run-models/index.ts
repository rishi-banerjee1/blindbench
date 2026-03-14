/**
 * run-models Edge Function
 *
 * Default models: Gemini (free) + Groq (free)
 * BYOK: Users can optionally provide their own API keys for OpenAI/Anthropic.
 * User-provided keys are used per-request only and NEVER stored.
 *
 * Environment variables required:
 *   GEMINI_API_KEY
 *   GROQ_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars (for server-side defaults):
 *   OPENAI_API_KEY
 *   ANTHROPIC_API_KEY
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { validatePrompt } from "../_shared/validation.ts";
import { checkRateLimit, hashIp } from "../_shared/rate-limit.ts";
import { callModel, resolveAllModels } from "../_shared/model-caller.ts";

// ─── Main Handler ───────────────────────────────────────────

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
    const { prompt, byok } = body;

    // Validate input
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedPrompt = validation.sanitized!;

    // Rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const ipHash = await hashIp(clientIp);

    const rateCheck = await checkRateLimit(ipHash, "run-models");
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Max 5 requests per minute.",
          retryAfterSeconds: 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        },
      );
    }

    // Initialize Supabase client (service role — bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Store the prompt
    const { data: promptRow, error: promptError } = await supabase
      .from("prompts")
      .insert({ text: sanitizedPrompt, ip_hash: ipHash })
      .select("id")
      .single();

    if (promptError) {
      console.error("Failed to store prompt:", promptError.message);
      return new Response(
        JSON.stringify({ error: "Failed to store prompt." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const promptId = promptRow.id;

    // Determine which models to run
    const modelsToRun = resolveAllModels(byok || {});

    // Call all models in parallel
    const results = await Promise.allSettled(
      modelsToRun.map(({ config, apiKey }) =>
        callModel(config, sanitizedPrompt, apiKey),
      ),
    );

    const responses: Array<{
      model: string;
      response_text: string;
      error?: string;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const model = modelsToRun[i].config;

      if (result.status === "fulfilled") {
        const { error } = await supabase.from("responses").insert({
          prompt_id: promptId,
          model: model.id,
          response_text: result.value,
        });
        if (error) console.error(`Failed to store ${model.id} response:`, error.message);
        responses.push({ model: model.id, response_text: result.value });
      } else {
        console.error(`${model.id} call failed:`, result.reason);
        responses.push({
          model: model.id,
          response_text: "",
          error: `${model.label} call failed`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        prompt_id: promptId,
        responses,
        rate_limit_remaining: rateCheck.remaining,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error in run-models:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

