import { useState } from "react";
import PromptInput from "../components/PromptInput";
import ResponseCard from "../components/ResponseCard";
import BYOKPanel from "../components/BYOKPanel";
import { submitPrompt, analyzeTruth, analyzeReasoning, submitVote, runStabilityTest, runPerturbationTest } from "../services/api";
import { modelDisplayName } from "../utils/models";
import { computeStabilityScore } from "../analytics/stabilityEmbedding";
import { detectFailurePatterns } from "../analytics/failurePatterns";
import { analyzePerturbations, perturbationLabel } from "../analytics/perturbationAnalysis";
import { estimateTokens } from "../analytics/tokenAnalysis";

export default function Arena() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [voted, setVoted] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [byokKeys, setByokKeys] = useState({ openai_key: "", anthropic_key: "" });
  const [stabilityLoading, setStabilityLoading] = useState(false);
  const [stabilityResult, setStabilityResult] = useState(null);
  const [perturbationLoading, setPerturbationLoading] = useState(false);
  const [perturbationResult, setPerturbationResult] = useState(null);
  const [embeddingStability, setEmbeddingStability] = useState(null);

  async function handleSubmit(prompt) {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyses(null);
    setVoted(null);
    setRevealed(false);
    setStabilityResult(null);
    setPerturbationResult(null);
    setEmbeddingStability(null);

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

  async function handleStabilityTest(promptId) {
    setStabilityLoading(true);
    try {
      const data = await runStabilityTest(promptId);
      setStabilityResult(data);

      // Compute embedding/TF-IDF stability scores (frontend-only, Step 1)
      const embResults = {};
      for (const sr of (data.stability_results || [])) {
        const texts = sr.run_details?.map((d) => d.response_text).filter(Boolean) || [];
        if (texts.length >= 2) {
          const openaiKey = byokKeys.openai_key?.trim() || null;
          embResults[sr.model] = await computeStabilityScore(texts, openaiKey);
        }
      }
      setEmbeddingStability(embResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setStabilityLoading(false);
    }
  }

  async function handlePerturbationTest(promptId) {
    setPerturbationLoading(true);
    try {
      const data = await runPerturbationTest(promptId);
      setPerturbationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPerturbationLoading(false);
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
          Gemini 3 Flash vs Llama 3.3 70B — blind comparison.
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
            <div className="text-center text-sm text-gray-400 space-y-2">
              <p>
                You voted for{" "}
                <span className="text-amber-400 font-medium">{modelDisplayName(voted)}</span>.
                Model identities revealed above.
              </p>
              {/* Secondary failure patterns (Step 2) */}
              {responses.map((r) => {
                const patterns = detectFailurePatterns(r.response_text, getAnalysis(r.model).failureType);
                const tokens = estimateTokens(r.response_text);
                if (patterns.length === 0 && !tokens) return null;
                return (
                  <div key={r.model} className="text-xs text-gray-500">
                    {modelDisplayName(r.model)}: ~{tokens} tokens
                    {patterns.length > 0 && (
                      <span className="ml-2">
                        Secondary patterns:{" "}
                        {patterns.map((p) => (
                          <span key={p.pattern} className="text-purple-400 ml-1">
                            {p.pattern.replace(/_/g, " ")}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {voted && result?.prompt_id && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">Research Tools</h3>
              <p className="text-xs text-gray-500">
                Run additional analysis on this comparison. These tests make multiple API calls and may take a moment.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleStabilityTest(result.prompt_id)}
                  disabled={stabilityLoading || !!stabilityResult}
                  className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {stabilityLoading ? "Testing stability..." : stabilityResult ? "Stability tested" : "Run Stability Test"}
                </button>
                <button
                  onClick={() => handlePerturbationTest(result.prompt_id)}
                  disabled={perturbationLoading || !!perturbationResult}
                  className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {perturbationLoading ? "Testing sensitivity..." : perturbationResult ? "Sensitivity tested" : "Run Perturbation Test"}
                </button>
              </div>
              {stabilityResult && (
                <div className="text-xs text-gray-400 space-y-2 border-t border-gray-800 pt-2">
                  <p className="text-gray-300 font-medium">Stability Results:</p>
                  {stabilityResult.stability_results?.map((sr) => (
                    <div key={sr.model} className="space-y-0.5">
                      <p>
                        {modelDisplayName(sr.model)}:{" "}
                        <span className="font-mono text-blue-400">
                          {(sr.stability_score * 100).toFixed(0)}%
                        </span>{" "}
                        Jaccard across {sr.run_details?.length || 3} runs
                        {embeddingStability?.[sr.model] && (
                          <>
                            {" "}| <span className="font-mono text-cyan-400">
                              {(embeddingStability[sr.model].score * 100).toFixed(0)}%
                            </span>{" "}
                            {embeddingStability[sr.model].method === "embedding" ? "embedding cosine" : "TF-IDF cosine"}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {perturbationResult && (() => {
                const pertAnalysis = result?.responses?.[0]?.response_text
                  ? analyzePerturbations(
                      result.responses[0].response_text,
                      perturbationResult.variants || []
                    )
                  : null;
                return (
                  <div className="text-xs text-gray-400 space-y-1 border-t border-gray-800 pt-2">
                    <p className="text-gray-300 font-medium">Prompt Sensitivity:</p>
                    <p>
                      Sensitivity score:{" "}
                      <span className="font-mono text-amber-400">
                        {(perturbationResult.sensitivity_score * 100).toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-gray-500">
                      {perturbationResult.variants?.length || 0} variants tested.{" "}
                      {perturbationResult.sensitivity_score < 0.3
                        ? "Models are robust to rephrasing."
                        : perturbationResult.sensitivity_score < 0.6
                        ? "Moderate sensitivity to rephrasing."
                        : "High sensitivity — models give different answers to equivalent prompts."}
                    </p>
                    {pertAnalysis && Object.keys(pertAnalysis.distribution).length > 0 && (
                      <div className="pt-1">
                        <span className="text-gray-500">Perturbation types: </span>
                        {Object.entries(pertAnalysis.distribution).map(([type, count]) => (
                          <span key={type} className="text-purple-400 mr-2">
                            {perturbationLabel(type)} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
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
