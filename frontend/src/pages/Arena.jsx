import { useState } from "react";
import PromptInput from "../components/PromptInput";
import ResponseCard from "../components/ResponseCard";
import BYOKPanel from "../components/BYOKPanel";
import { submitPrompt, analyzeTruth, analyzeReasoning, submitVote } from "../services/api";
import { modelDisplayName } from "../utils/models";

export default function Arena() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [voted, setVoted] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [byokKeys, setByokKeys] = useState({ openai_key: "", anthropic_key: "" });

  async function handleSubmit(prompt) {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyses(null);
    setVoted(null);
    setRevealed(false);

    try {
      // Build BYOK payload — only include non-empty keys
      const byok = {};
      if (byokKeys.openai_key?.trim()) byok.openai_key = byokKeys.openai_key.trim();
      if (byokKeys.anthropic_key?.trim()) byok.anthropic_key = byokKeys.anthropic_key.trim();

      // Step 1: Submit prompt and get model responses
      const data = await submitPrompt(prompt, byok);
      setResult(data);

      // Step 2: Trigger analysis in parallel (non-blocking for UX)
      const [truthResult, reasoningResult] = await Promise.allSettled([
        analyzeTruth(data.prompt_id),
        analyzeReasoning(data.prompt_id),
      ]);

      setAnalyses({
        truth:
          truthResult.status === "fulfilled" ? truthResult.value : null,
        reasoning:
          reasoningResult.status === "fulfilled"
            ? reasoningResult.value
            : null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(model) {
    if (!result?.prompt_id || voted) return;

    try {
      await submitVote(result.prompt_id, model);
      setVoted(model);
      setRevealed(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // Shuffle model order for blind comparison
  const responses = result?.responses || [];
  const modelA = responses[0];
  const modelB = responses[1];

  function getAnalysis(model) {
    if (!analyses) return {};
    const truthItem = analyses.truth?.analyses?.find(
      (a) => a.model === model
    );
    const reasoningItem = analyses.reasoning?.analyses?.find(
      (a) => a.model === model
    );
    return {
      truthScore: truthItem?.truth_score ?? null,
      failureType: reasoningItem?.failure_type ?? null,
    };
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Arena</h1>
        <p className="text-gray-400 text-sm">
          Gemini 2.0 Flash vs Llama 3.3 70B — blind comparison.
          Add your own keys below to include GPT-4o or Claude Sonnet 4.
          Models are hidden until you vote.
        </p>
      </div>

      <PromptInput onSubmit={handleSubmit} loading={loading} />

      <BYOKPanel keys={byokKeys} onChange={setByokKeys} />

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && responses.length >= 2 && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <ResponseCard
              label={revealed ? modelDisplayName(modelA.model) : "Model A"}
              responseText={modelA.response_text}
              truthScore={getAnalysis(modelA.model).truthScore}
              failureType={getAnalysis(modelA.model).failureType}
              onVote={() => handleVote(modelA.model)}
              disabled={loading}
              voted={voted === modelA.model}
            />
            <ResponseCard
              label={revealed ? modelDisplayName(modelB.model) : "Model B"}
              responseText={modelB.response_text}
              truthScore={getAnalysis(modelB.model).truthScore}
              failureType={getAnalysis(modelB.model).failureType}
              onVote={() => handleVote(modelB.model)}
              disabled={loading}
              voted={voted === modelB.model}
            />
          </div>

          {voted && (
            <div className="text-center text-sm text-gray-400">
              You voted for{" "}
              <span className="text-amber-400 font-medium">{modelDisplayName(voted)}</span>.
              Model identities revealed above.
            </div>
          )}

          {result.rate_limit_remaining !== undefined && (
            <p className="text-xs text-gray-600 text-center">
              Rate limit remaining: {result.rate_limit_remaining}/5 this
              minute
            </p>
          )}
        </>
      )}
    </div>
  );
}
