/**
 * Friendly display names for model IDs.
 * For known models, return a curated name.
 * For unknown models, generate a readable name from the ID.
 */
const MODEL_NAMES = {
  "google/gemini-2.0-flash": "Gemini 2.0 Flash",
  "google/gemini-3-flash-preview": "Gemini 3 Flash",
  "groq/llama-3.3-70b-versatile": "Llama 3.3 70B",
  "openai/gpt-4o": "GPT-4o",
  "anthropic/claude-sonnet-4-20250514": "Claude Sonnet 4",
};

/**
 * Get a human-friendly display name for a model ID.
 * Falls back to a cleaned-up version of the raw ID.
 */
export function modelDisplayName(modelId) {
  if (MODEL_NAMES[modelId]) return MODEL_NAMES[modelId];

  // Auto-generate a readable name from "creator/model-slug"
  const parts = modelId.split("/");
  const slug = parts.length > 1 ? parts[1] : parts[0];
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
