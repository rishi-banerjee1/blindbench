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
