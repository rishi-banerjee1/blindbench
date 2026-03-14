/**
 * API service — all calls route through Supabase Edge Functions.
 * No direct calls to OpenAI or Anthropic from the frontend.
 */
import { supabase } from "./supabase";

/**
 * Submit a prompt to the arena.
 * Calls the run-models edge function which handles LLM calls server-side.
 *
 * @param {string} prompt - The user's prompt
 * @param {object} byok - Optional BYOK keys: { openai_key, anthropic_key }
 *   User-provided keys are sent per-request and NEVER stored.
 */
export async function submitPrompt(prompt, byok = {}) {
  const { data, error } = await supabase.functions.invoke("run-models", {
    body: { prompt, byok },
  });

  if (error) {
    throw new Error(error.message || "Failed to submit prompt.");
  }

  return data;
}

/**
 * Trigger truth analysis for a prompt's responses.
 */
export async function analyzeTruth(promptId) {
  const { data, error } = await supabase.functions.invoke("truth-analyzer", {
    body: { prompt_id: promptId },
  });

  if (error) {
    throw new Error(error.message || "Truth analysis failed.");
  }

  return data;
}

/**
 * Trigger reasoning failure analysis for a prompt's responses.
 */
export async function analyzeReasoning(promptId) {
  const { data, error } = await supabase.functions.invoke(
    "reasoning-analyzer",
    { body: { prompt_id: promptId } }
  );

  if (error) {
    throw new Error(error.message || "Reasoning analysis failed.");
  }

  return data;
}

/**
 * Submit a vote for the winning model.
 */
export async function submitVote(promptId, winnerModel) {
  const { error } = await supabase.from("votes").insert({
    prompt_id: promptId,
    winner_model: winnerModel,
    ip_hash: "client", // Server-side edge function should hash this
  });

  if (error) {
    throw new Error(error.message || "Failed to submit vote.");
  }
}

/**
 * Fetch leaderboard data from the materialized view.
 */
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_wins", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch leaderboard.");
  }

  return data;
}

/**
 * Fetch failure summary data from the materialized view.
 */
export async function fetchFailureSummary() {
  const { data, error } = await supabase
    .from("failure_summary")
    .select("*")
    .order("occurrence_count", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch failure data.");
  }

  return data;
}

/**
 * Fetch recent prompts with their responses.
 */
export async function fetchRecentPrompts(limit = 20) {
  const { data, error } = await supabase
    .from("prompts")
    .select(
      `
      id,
      text,
      created_at,
      responses (
        id,
        model,
        response_text,
        truth_score,
        failure_type
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to fetch prompts.");
  }

  return data;
}

// ─── Research Tools ─────────────────────────────────────────

/**
 * Trigger stability testing for a prompt's responses.
 * Runs each model 3 times and computes response variance.
 */
export async function runStabilityTest(promptId) {
  const { data, error } = await supabase.functions.invoke("stability-tester", {
    body: { prompt_id: promptId },
  });
  if (error) throw new Error(error.message || "Stability test failed.");
  return data;
}

/**
 * Trigger prompt perturbation testing.
 * Generates semantic variants and tests model sensitivity.
 */
export async function runPerturbationTest(promptId) {
  const { data, error } = await supabase.functions.invoke("prompt-perturber", {
    body: { prompt_id: promptId },
  });
  if (error) throw new Error(error.message || "Perturbation test failed.");
  return data;
}

/**
 * Export dataset as JSON or CSV.
 * Uses a direct fetch since supabase.functions.invoke doesn't support GET.
 */
export async function exportDataset(format = "json", filters = {}) {
  const params = new URLSearchParams({ format });
  if (filters.model) params.set("model", filters.model);
  if (filters.failure_type) params.set("failure_type", filters.failure_type);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/dataset-export?${params}`,
    {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Export failed" }));
    throw new Error(err.error || "Dataset export failed.");
  }

  if (format === "csv") {
    return response.text();
  }
  return response.json();
}

/**
 * Fetch model performance summary for analytics.
 */
export async function fetchModelPerformance() {
  const { data, error } = await supabase
    .from("model_performance_summary")
    .select("*")
    .order("avg_truth_score", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message || "Failed to fetch performance data.");
  return data;
}

/**
 * Fetch evaluation records for the dataset explorer.
 */
export async function fetchEvaluationRecords(limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from("evaluation_records")
    .select("*")
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message || "Failed to fetch evaluation records.");
  return data;
}
