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

// ─── Model Registry ─────────────────────────────────────────

interface ModelConfig {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "openai" | "anthropic";
  envKey: string;       // env var name for the server-side key
  byokParam: string;    // body param name for user-provided key
}

const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    byokParam: "gemini_key",
  },
  {
    id: "groq/llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (Groq)",
    provider: "groq",
    envKey: "GROQ_API_KEY",
    byokParam: "groq_key",
  },
];

const BYOK_MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    envKey: "OPENAI_API_KEY",
    byokParam: "openai_key",
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    byokParam: "anthropic_key",
  },
];

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
    const modelsToRun = resolveModels(byok || {});

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

// ─── Model Resolution ───────────────────────────────────────

interface ResolvedModel {
  config: ModelConfig;
  apiKey: string;
}

/**
 * Resolve which models to run.
 * Always runs the 2 default models (Gemini + Groq).
 * If user provides BYOK keys, also runs those models.
 */
function resolveModels(byok: Record<string, string>): ResolvedModel[] {
  const resolved: ResolvedModel[] = [];

  // Always include default models
  for (const config of DEFAULT_MODELS) {
    const key = byok[config.byokParam] || Deno.env.get(config.envKey);
    if (key) {
      resolved.push({ config, apiKey: key });
    }
  }

  // Add BYOK models if user provided keys
  for (const config of BYOK_MODELS) {
    const userKey = byok[config.byokParam];
    const envKey = Deno.env.get(config.envKey);
    const key = userKey || envKey;
    if (key) {
      resolved.push({ config, apiKey: key });
    }
  }

  return resolved;
}

// ─── Unified Model Caller ───────────────────────────────────

async function callModel(
  config: ModelConfig,
  prompt: string,
  apiKey: string,
): Promise<string> {
  switch (config.provider) {
    case "gemini":
      return callGemini(prompt, apiKey);
    case "groq":
      return callGroq(prompt, apiKey);
    case "openai":
      return callOpenAI(prompt, apiKey);
    case "anthropic":
      return callAnthropic(prompt, apiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ─── Provider-Specific Callers ──────────────────────────────

const SYSTEM_PROMPT =
  "You are a helpful assistant. Provide accurate, well-reasoned answers. If you are uncertain, say so.";

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      system: SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}
