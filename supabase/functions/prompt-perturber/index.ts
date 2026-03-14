/**
 * prompt-perturber Edge Function
 *
 * Generates semantic prompt variants and tests model sensitivity.
 * Uses GPT-4o to create 2 variants (paraphrase + restructure).
 * Runs each variant through default models and computes sensitivity_score.
 *
 * Canonical prompt template: see evaluators/perturbation-prompt.md
 * Rate limited to 1 per 5 minutes per IP.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, hashIp } from "../_shared/rate-limit.ts";
import {
  callModel,
  jaccardSimilarity,
  resolveDefaultModels,
} from "../_shared/model-caller.ts";

const PERTURBATION_PROMPT = `You are a prompt perturbation generator for LLM evaluation research. Given a user prompt, generate exactly 2 semantically equivalent variants that test model sensitivity to surface-level changes.

Return a JSON object with this exact structure:
{
  "variants": [
    { "text": "variant prompt text", "type": "paraphrase" },
    { "text": "variant prompt text", "type": "restructure" }
  ]
}

Rules:
- Variant 1 (paraphrase): Rephrase using different vocabulary but identical meaning
- Variant 2 (restructure): Change sentence structure or order but preserve the question
- Do NOT change the factual content, intent, or difficulty level
- Keep similar length (within 20% of the original)
- Return ONLY valid JSON, no markdown fences`;

interface VariantResult {
  text: string;
  type: string;
}

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

    // Rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const ipHash = await hashIp(clientIp);

    const rateCheck = await checkRateLimit(ipHash, "prompt-perturber");
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Perturbation test rate limited. Max 1 per 5 minutes.",
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

    // Fetch the original prompt
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

    const originalPrompt = promptData.text;

    // Generate variants using GPT-4o
    const variants = await generateVariants(originalPrompt);
    if (!variants || variants.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to generate prompt variants." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Store variants in prompt_variants table
    const storedVariants: Array<{
      variant_id: string;
      variant_text: string;
      variant_type: string;
    }> = [];

    for (const variant of variants) {
      const { data: variantRow, error: variantErr } = await supabase
        .from("prompt_variants")
        .insert({
          parent_prompt_id: prompt_id,
          variant_text: variant.text,
          variant_type: variant.type,
        })
        .select("id")
        .single();

      if (!variantErr && variantRow) {
        storedVariants.push({
          variant_id: variantRow.id,
          variant_text: variant.text,
          variant_type: variant.type,
        });
      }
    }

    // Fetch original responses for comparison
    const { data: originalResponses } = await supabase
      .from("responses")
      .select("model, response_text")
      .eq("prompt_id", prompt_id)
      .is("run_number", null);

    // Run variants through default models
    const models = resolveDefaultModels();
    const allVariantResponses: Record<string, string[]> = {};

    for (const variant of storedVariants) {
      for (const { config, apiKey } of models) {
        try {
          const response = await callModel(config, variant.variant_text, apiKey);

          // Store variant response
          await supabase.from("responses").insert({
            prompt_id: prompt_id,
            model: config.id,
            response_text: response,
            run_number: -1, // Negative to distinguish from stability runs
            stability_group_id: prompt_id,
          });

          if (!allVariantResponses[config.id]) {
            allVariantResponses[config.id] = [];
          }
          allVariantResponses[config.id].push(response);
        } catch (err) {
          console.error(
            `Variant run failed for ${config.id}:`,
            err,
          );
        }
      }
    }

    // Compute sensitivity score per model
    // Compare original response to variant responses
    let totalSensitivity = 0;
    let modelCount = 0;

    for (const origResp of originalResponses || []) {
      const variantResps = allVariantResponses[origResp.model];
      if (!variantResps || variantResps.length === 0) continue;

      let totalSim = 0;
      for (const vResp of variantResps) {
        totalSim += jaccardSimilarity(origResp.response_text, vResp);
      }
      const avgSimilarity = totalSim / variantResps.length;
      totalSensitivity += 1 - avgSimilarity; // sensitivity = 1 - similarity
      modelCount++;
    }

    const sensitivityScore =
      modelCount > 0
        ? Math.round((totalSensitivity / modelCount) * 1000) / 1000
        : 0;

    // Update sensitivity_score on stored variants
    for (const variant of storedVariants) {
      await supabase
        .from("prompt_variants")
        .update({ sensitivity_score: sensitivityScore })
        .eq("id", variant.variant_id);
    }

    return new Response(
      JSON.stringify({
        prompt_id,
        variants: storedVariants,
        sensitivity_score: sensitivityScore,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error in prompt-perturber:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function generateVariants(prompt: string): Promise<VariantResult[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PERTURBATION_PROMPT },
        {
          role: "user",
          content: `Generate perturbation variants for this prompt:\n\n"${prompt}"`,
        },
      ],
      max_tokens: 512,
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return parsed.variants || [];
  } catch {
    console.error("Failed to parse perturbation JSON:", content);
    return [];
  }
}
