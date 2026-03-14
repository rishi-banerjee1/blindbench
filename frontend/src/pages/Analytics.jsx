import { useState, useEffect } from "react";
import { fetchModelPerformance, fetchFailureSummary } from "../services/api";
import { modelDisplayName } from "../utils/models";

function BarChart({ items, maxValue, colorClass = "bg-amber-400" }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key || item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-36 text-right truncate" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${colorClass} transition-all`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 font-mono w-14 text-right">
            {item.display}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [performance, setPerformance] = useState([]);
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [perfData, failData] = await Promise.allSettled([
          fetchModelPerformance(),
          fetchFailureSummary(),
        ]);
        if (cancelled) return;
        if (perfData.status === "fulfilled") setPerformance(perfData.value || []);
        if (failData.status === "fulfilled") setFailures(failData.value || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Aggregate failure data by type
  const failureByType = {};
  for (const row of failures) {
    if (!failureByType[row.failure_type]) failureByType[row.failure_type] = 0;
    failureByType[row.failure_type] += row.occurrence_count;
  }
  const sortedFailures = Object.entries(failureByType)
    .map(([type, count]) => ({ label: type.replace(/_/g, " "), value: count, display: String(count) }))
    .sort((a, b) => b.value - a.value);

  const maxFailureCount = sortedFailures[0]?.value || 0;

  // Truth score chart data
  const truthItems = performance
    .filter((m) => m.avg_truth_score != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.avg_truth_score),
      display: `${(parseFloat(m.avg_truth_score) * 100).toFixed(0)}%`,
    }));

  // Failure rate chart data
  const failureRateItems = performance
    .filter((m) => m.failure_rate != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.failure_rate),
      display: `${(parseFloat(m.failure_rate) * 100).toFixed(0)}%`,
    }))
    .sort((a, b) => b.value - a.value);

  // Stability chart data
  const stabilityItems = performance
    .filter((m) => m.avg_stability_score != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.avg_stability_score),
      display: `${(parseFloat(m.avg_stability_score) * 100).toFixed(0)}%`,
    }))
    .sort((a, b) => b.value - a.value);

  if (loading) {
    return <div className="text-gray-500 text-sm py-8 text-center">Loading analytics...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">Analytics</h1>
        <p className="text-gray-400 text-sm">
          Model performance overview and failure pattern analysis.
        </p>
      </div>

      {/* Model Truth Scores */}
      {truthItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Average Truth Score by Model</h2>
          <p className="text-xs text-gray-500">Higher is better. Based on factual claim verification.</p>
          <BarChart items={truthItems} maxValue={1} colorClass="bg-green-400" />
        </section>
      )}

      {/* Failure Type Distribution */}
      {sortedFailures.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Failure Type Distribution</h2>
          <p className="text-xs text-gray-500">Total occurrences across all models.</p>
          <BarChart items={sortedFailures} maxValue={maxFailureCount} colorClass="bg-red-400" />
        </section>
      )}

      {/* Failure Rate by Model */}
      {failureRateItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Failure Rate by Model</h2>
          <p className="text-xs text-gray-500">Percentage of responses with a detected reasoning failure.</p>
          <BarChart items={failureRateItems} maxValue={1} colorClass="bg-amber-400" />
        </section>
      )}

      {/* Stability Scores */}
      {stabilityItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Response Stability by Model</h2>
          <p className="text-xs text-gray-500">How consistent are responses when the same prompt is run multiple times. Higher = more stable.</p>
          <BarChart items={stabilityItems} maxValue={1} colorClass="bg-blue-400" />
        </section>
      )}

      {/* Summary Stats */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Model Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2 pr-4">Model</th>
                <th className="text-right py-2 px-3">Responses</th>
                <th className="text-right py-2 px-3">Avg Truth</th>
                <th className="text-right py-2 px-3">Failure Rate</th>
                <th className="text-right py-2 px-3">Stability</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((m) => (
                <tr key={m.model} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-medium">{modelDisplayName(m.model)}</td>
                  <td className="text-right py-2 px-3 text-gray-400">{m.total_responses}</td>
                  <td className="text-right py-2 px-3">
                    <span className={
                      m.avg_truth_score >= 0.7 ? "text-green-400" :
                      m.avg_truth_score >= 0.4 ? "text-yellow-400" :
                      "text-red-400"
                    }>
                      {m.avg_truth_score != null ? `${(m.avg_truth_score * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className={m.failure_rate > 0.3 ? "text-red-400" : "text-gray-300"}>
                      {m.failure_rate != null ? `${(m.failure_rate * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className="text-blue-400">
                      {m.avg_stability_score != null ? `${(m.avg_stability_score * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {performance.length === 0 && failures.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          No data yet. Submit prompts in the Arena to generate analytics.
        </div>
      )}
    </div>
  );
}
