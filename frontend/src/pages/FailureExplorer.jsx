import { useState, useEffect } from "react";
import { fetchFailureSummary } from "../services/api";
import { escapeHtml } from "../utils/sanitize";
import { modelDisplayName } from "../utils/models";

const FAILURE_DESCRIPTIONS = {
  hallucination: "Fabricated facts, citations, or data that don't exist.",
  logical_fallacy: "Formal or informal logical errors in reasoning.",
  circular_reasoning: "Conclusion is presupposed in the premise.",
  false_premise_acceptance: "Accepted a false premise without challenge.",
  overconfidence: "Stated uncertain things with false certainty.",
  sycophancy: "Agreed with the user when it shouldn't have.",
  anchoring_bias: "Over-relied on the first piece of information given.",
  failure_to_abstain:
    "Answered definitively when it should have said 'I don't know'.",
  contradiction: "Contradicted itself within the response.",
  straw_man: "Misrepresented the question or an argument.",
};

function FailureCard({ type, models, isExpanded, onToggle }) {
  const top5 = models.slice(0, 5);
  const totalCount = models.reduce((sum, m) => sum + m.occurrence_count, 0);
  const avgScore =
    models.reduce((sum, m) => sum + (m.avg_truth_score || 0) * m.occurrence_count, 0) /
    totalCount;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-red-400 text-xs bg-red-900/20 px-2.5 py-1 rounded-full font-medium">
            {type.replace(/_/g, " ")}
          </span>
          <span className="text-gray-500 text-xs">
            {models.length} model{models.length !== 1 ? "s" : ""} &middot;{" "}
            {totalCount} total occurrences
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-sm font-mono ${
              avgScore >= 0.7
                ? "text-green-400"
                : avgScore >= 0.4
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {(avgScore * 100).toFixed(0)}% avg
          </span>
          <span className="text-gray-500 text-sm">
            {isExpanded ? "▼" : "▶"}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800">
          {FAILURE_DESCRIPTIONS[type] && (
            <div className="px-4 py-2 text-xs text-gray-500 bg-gray-900/50">
              {FAILURE_DESCRIPTIONS[type]}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="px-4 py-2 text-left font-medium text-xs">
                  Model
                </th>
                <th className="px-4 py-2 text-right font-medium text-xs">
                  Count
                </th>
                <th className="px-4 py-2 text-right font-medium text-xs">
                  Avg Truth Score
                </th>
              </tr>
            </thead>
            <tbody>
              {(isExpanded === "all" ? models : top5).map((row) => (
                <tr
                  key={row.model}
                  className="border-b border-gray-800/30 hover:bg-gray-800/20"
                >
                  <td className="px-4 py-2 text-gray-300 text-xs">
                    {escapeHtml(modelDisplayName(row.model))}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-400 text-xs">
                    {row.occurrence_count}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    <span
                      className={
                        row.avg_truth_score >= 0.7
                          ? "text-green-400"
                          : row.avg_truth_score >= 0.4
                          ? "text-yellow-400"
                          : "text-red-400"
                      }
                    >
                      {row.avg_truth_score !== null
                        ? `${(row.avg_truth_score * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {models.length > 5 && isExpanded !== "all" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle("all");
              }}
              className="w-full py-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-gray-800/30 transition-colors"
            >
              Show all {models.length} models
            </button>
          )}
          {isExpanded === "all" && models.length > 5 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(true);
              }}
              className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
            >
              Show top 5 only
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function FailureExplorer() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchFailureSummary();
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group by failure type, sorted by total occurrences
  const grouped = {};
  for (const row of data) {
    if (!grouped[row.failure_type]) grouped[row.failure_type] = [];
    grouped[row.failure_type].push(row);
  }

  const sortedTypes = Object.entries(grouped)
    .map(([type, models]) => ({
      type,
      models: models.sort((a, b) => b.occurrence_count - a.occurrence_count),
      total: models.reduce((s, m) => s + m.occurrence_count, 0),
    }))
    .sort((a, b) => b.total - a.total);

  function toggleExpand(type, mode) {
    setExpanded((prev) => {
      if (mode === "all") return { ...prev, [type]: "all" };
      if (mode === true) return { ...prev, [type]: true };
      return { ...prev, [type]: prev[type] ? false : true };
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Failure Explorer</h1>
        <p className="text-gray-400 text-sm">
          Reasoning failure patterns detected across {
            new Set(data.map((d) => d.model)).size
          }{" "}
          models. Click a category to see top offenders.
        </p>
      </div>

      {loading && (
        <div className="text-gray-500 text-sm py-8 text-center">
          Loading failure data...
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="text-gray-500 text-sm py-8 text-center">
          No failures detected yet. Submit prompts in the Arena to start
          analysis.
        </div>
      )}

      {sortedTypes.length > 0 && (
        <div className="space-y-3">
          {sortedTypes.map(({ type, models }) => (
            <FailureCard
              key={type}
              type={type}
              models={models}
              isExpanded={expanded[type]}
              onToggle={(mode) => toggleExpand(type, mode)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Data from 4 Kaggle datasets (LLM EvaluationHub, Prompt Engineering, AI
        Models Benchmark 2026). Live results update as users submit prompts.
      </p>
    </div>
  );
}
