import { useState, useEffect } from "react";
import { fetchFailureSummary } from "../services/api";
import { escapeHtml } from "../utils/sanitize";

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

export default function FailureExplorer() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

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

  // Get unique failure types
  const failureTypes = [...new Set(data.map((d) => d.failure_type))];

  // Filter by selected type
  const filtered = selectedType
    ? data.filter((d) => d.failure_type === selectedType)
    : data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Failure Explorer</h1>
        <p className="text-gray-400 text-sm">
          Browse reasoning failure patterns detected across model responses.
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

      {data.length > 0 && (
        <>
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedType === null
                  ? "bg-amber-400/20 text-amber-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              All
            </button>
            {failureTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedType === type
                    ? "bg-amber-400/20 text-amber-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Failure description */}
          {selectedType && FAILURE_DESCRIPTIONS[selectedType] && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-400">
              <span className="text-amber-400 font-medium">
                {selectedType.replace(/_/g, " ")}
              </span>
              : {FAILURE_DESCRIPTIONS[selectedType]}
            </div>
          )}

          {/* Data table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Failure Type
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Count</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Avg Truth Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={`${row.model}-${row.failure_type}`}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {escapeHtml(row.model)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-red-400 text-xs bg-red-900/20 px-2 py-0.5 rounded-full">
                        {row.failure_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {row.occurrence_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
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
          </div>
        </>
      )}
    </div>
  );
}
