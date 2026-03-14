/**
 * Shared model calling utilities.
 * Extracted from run-models to be reused by stability-tester and prompt-perturber.
 *
 * Canonical evaluator prompts: see evaluators/ directory in repo root.
 */

// ─── Types ──────────────────────────────────────────────────

export interface ModelConfig {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "openai" | "anthropic";
  envKey: string;
  byokParam: string;
}

export interface ResolvedModel {
  config: ModelConfig;
  apiKey: string;
}

// ─── Constants ──────────────────────────────────────────────

export const SYSTEM_PROMPT =
  "You are a helpful assistant. Provide accurate, well-reasoned answers. If you are uncertain, say so.";

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash",
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

export const BYOK_MODELS: ModelConfig[] = [
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

// ─── Model Resolution ───────────────────────────────────────

/**
 * Resolve default models only (no BYOK). Used by stability-tester and prompt-perturber.
 */
export function resolveDefaultModels(): ResolvedModel[] {
  const resolved: ResolvedModel[] = [];
  for (const config of DEFAULT_MODELS) {
    const key = Deno.env.get(config.envKey);
    if (key) {
      resolved.push({ config, apiKey: key });
    }
  }
  return resolved;
}

/**
 * Resolve all models including BYOK. Used by run-models.
 */
export function resolveAllModels(
  byok: Record<string, string>,
): ResolvedModel[] {
  const resolved: ResolvedModel[] = [];

  for (const config of DEFAULT_MODELS) {
    const key = byok[config.byokParam] || Deno.env.get(config.envKey);
    if (key) {
      resolved.push({ config, apiKey: key });
    }
  }

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

export async function callModel(
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

export async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

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

export async function callGroq(
  prompt: string,
  apiKey: string,
): Promise<string> {
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

export async function callOpenAI(
  prompt: string,
  apiKey: string,
): Promise<string> {
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

export async function callAnthropic(
  prompt: string,
  apiKey: string,
): Promise<string> {
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

// ─── Similarity Utilities ───────────────────────────────────

/**
 * Jaccard similarity on word-level unigrams.
 * Returns 0.0 (no overlap) to 1.0 (identical word sets).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

/**
 * Compute stability score from multiple responses.
 * Returns average pairwise Jaccard similarity (0-1, where 1 = identical).
 */
export function computeStabilityScore(responses: string[]): number {
  if (responses.length < 2) return 1;
  let totalSim = 0;
  let pairs = 0;
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      totalSim += jaccardSimilarity(responses[i], responses[j]);
      pairs++;
    }
  }
  return pairs > 0 ? Math.round((totalSim / pairs) * 1000) / 1000 : 1;
}
