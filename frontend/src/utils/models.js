/**
 * Friendly display names for model IDs.
 */
const MODEL_NAMES = {
  "google/gemini-2.0-flash": "Gemini 2.0 Flash",
  "groq/llama-3.3-70b-versatile": "Llama 3.3 70B",
  "openai/gpt-4o": "GPT-4o",
  "anthropic/claude-sonnet-4-20250514": "Claude Sonnet 4",
};

/**
 * Get a human-friendly display name for a model ID.
 * Falls back to the raw ID if no mapping exists.
 */
export function modelDisplayName(modelId) {
  return MODEL_NAMES[modelId] || modelId;
}
