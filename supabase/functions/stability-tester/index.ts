/**
 * stability-tester Edge Function
 *
 * Runs the same prompt 3 times per default model to measure response consistency.
 * Computes a stability_score (0-1) via word-level Jaccard similarity.
 *
 * Only uses default models (Gemini + Groq) — no BYOK to control cost.
 * Rate limited to 1 per 5 minutes per IP.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, hashIp } from "../_shared/rate-limit.ts";
import {
  callModel,
  computeStabilityScore,
  resolveDefaultModels,
} from "../_shared/model-caller.ts";

const RUNS_PER_MODEL = 3;

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
    const { prompt_id } = await req.json();

    if (!prompt_id || typeof prompt_id !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt_id is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Rate limiting: 1 stability test per 5 minutes per IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const ipHash = await hashIp(clientIp);

    const rateCheck = await checkRateLimit(ipHash, "stability-tester");
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Stability test rate limited. Max 1 per 5 minutes.",
          retryAfterSeconds: 300,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "300",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the prompt text
    const { data: promptData, error: promptErr } = await supabase
      .from("prompts")
      .select("text")
      .eq("id", prompt_id)
      .single();

    if (promptErr || !promptData) {
      return new Response(JSON.stringify({ error: "Prompt not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptText = promptData.text;
    const models = resolveDefaultModels();

    if (models.length === 0) {
      return new Response(
        JSON.stringify({ error: "No models available for stability testing." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Run each model RUNS_PER_MODEL times
    const stabilityResults: Array<{
      model: string;
      stability_score: number;
      run_details: Array<{ run_number: number; response_text: string }>;
    }> = [];

    for (const { config, apiKey } of models) {
      // Run N times in parallel
      const runPromises = Array.from({ length: RUNS_PER_MODEL }, (_, i) =>
        callModel(config, promptText, apiKey).then((text) => ({
          run_number: i + 1,
          response_text: text,
        })),
      );

      const results = await Promise.allSettled(runPromises);
      const successfulRuns: Array<{
        run_number: number;
        response_text: string;
      }> = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          successfulRuns.push(result.value);
        }
      }

      if (successfulRuns.length < 2) {
        console.error(
          `${config.id}: only ${successfulRuns.length} successful runs, skipping`,
        );
        continue;
      }

      // Compute stability score
      const responseTexts = successfulRuns.map((r) => r.response_text);
      const stabilityScore = computeStabilityScore(responseTexts);

      // Store each run in responses table
      for (const run of successfulRuns) {
        await supabase.from("responses").insert({
          prompt_id: prompt_id,
          model: config.id,
          response_text: run.response_text,
          run_number: run.run_number,
          stability_group_id: prompt_id,
        });
      }

      // Update the original response's stability_score
      await supabase
        .from("responses")
        .update({ stability_score: stabilityScore })
        .eq("prompt_id", prompt_id)
        .eq("model", config.id)
        .is("run_number", null);

      stabilityResults.push({
        model: config.id,
        stability_score: stabilityScore,
        run_details: successfulRuns,
      });
    }

    return new Response(
      JSON.stringify({
        prompt_id,
        stability_results: stabilityResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error in stability-tester:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
