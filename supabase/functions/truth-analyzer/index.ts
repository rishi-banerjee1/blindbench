/**
 * truth-analyzer Edge Function
 *
 * Extracts factual claims from model responses and computes a truth score.
 * Uses OpenAI as the evaluator model to assess factual accuracy.
 *
 * Called after run-models to analyze stored responses.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const TRUTH_ANALYSIS_PROMPT = `You are a factual accuracy evaluator. Given a user prompt and a model's response, analyze the response for factual accuracy.

Return a JSON object with this exact structure:
{
  "claims": [
    { "claim": "string describing the factual claim", "accurate": true/false, "confidence": 0.0-1.0 }
  ],
  "truth_score": 0.0-1.0,
  "summary": "brief explanation of the overall accuracy"
}

Rules:
- truth_score is the weighted average of claim accuracies
- If no factual claims are present (e.g., opinion or creative content), return truth_score: null
- Only evaluate verifiable factual claims, not opinions or subjective statements
- Be conservative: if uncertain about a claim, mark confidence as low
- Return ONLY valid JSON, no markdown fences`;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the prompt and its responses
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

    const { data: responses, error: respErr } = await supabase
      .from("responses")
      .select("id, model, response_text")
      .eq("prompt_id", prompt_id);

    if (respErr || !responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ error: "No responses found for this prompt." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Analyze each response in parallel
    const analyses = await Promise.allSettled(
      responses.map(async (resp) => {
        const analysis = await analyzeTruth(promptData.text, resp.response_text);

        // Update the response record with the truth score
        if (analysis.truth_score !== null && analysis.truth_score !== undefined) {
          await supabase
            .from("responses")
            .update({ truth_score: analysis.truth_score })
            .eq("id", resp.id);
        }

        return {
          response_id: resp.id,
          model: resp.model,
          ...analysis,
        };
      }),
    );

    const results = analyses.map((a) =>
      a.status === "fulfilled"
        ? a.value
        : { error: "Analysis failed", reason: String(a.reason) },
    );

    return new Response(JSON.stringify({ prompt_id, analyses: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in truth-analyzer:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

interface TruthAnalysis {
  claims: Array<{
    claim: string;
    accurate: boolean;
    confidence: number;
  }>;
  truth_score: number | null;
  summary: string;
}

async function analyzeTruth(
  prompt: string,
  responseText: string,
): Promise<TruthAnalysis> {
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
        { role: "system", content: TRUTH_ANALYSIS_PROMPT },
        {
          role: "user",
          content: `User prompt: "${prompt}"\n\nModel response: "${responseText}"`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(content) as TruthAnalysis;
  } catch {
    console.error("Failed to parse truth analysis JSON:", content);
    return { claims: [], truth_score: null, summary: "Analysis parsing failed" };
  }
}
