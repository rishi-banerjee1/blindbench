import { useState, useEffect } from "react";
import { fetchModelPerformance, fetchFailureSummary, fetchEvaluationRecords } from "../services/api";
import { modelDisplayName } from "../utils/models";
import { generateInsights } from "../analytics/insightEngine";
import { computeTokenStatsByModel, computeLengthHallucinationCorrelation } from "../analytics/tokenAnalysis";
import { computeCalibrationByModel } from "../analytics/calibrationAnalysis";
import { aggregateFailurePatterns } from "../analytics/failurePatterns";

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

function StatCard({ label, value, sub, color = "text-amber-400" }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const [performance, setPerformance] = useState([]);
  const [failures, setFailures] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [perfData, failData, recData] = await Promise.allSettled([
          fetchModelPerformance(),
          fetchFailureSummary(),
          fetchEvaluationRecords(500, 0),
        ]);
        if (cancelled) return;
        if (perfData.status === "fulfilled") setPerformance(perfData.value || []);
        if (failData.status === "fulfilled") setFailures(failData.value || []);
        if (recData.status === "fulfilled") setRecords(recData.value || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Existing Charts ──────────────────────────────────────

  const failureByType = {};
  for (const row of failures) {
    if (!failureByType[row.failure_type]) failureByType[row.failure_type] = 0;
    failureByType[row.failure_type] += row.occurrence_count;
  }
  const sortedFailures = Object.entries(failureByType)
    .map(([type, count]) => ({ label: type.replace(/_/g, " "), value: count, display: String(count) }))
    .sort((a, b) => b.value - a.value);
  const maxFailureCount = sortedFailures[0]?.value || 0;

  const truthItems = performance
    .filter((m) => m.avg_truth_score != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.avg_truth_score),
      display: `${(parseFloat(m.avg_truth_score) * 100).toFixed(0)}%`,
    }));

  const failureRateItems = performance
    .filter((m) => m.failure_rate != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.failure_rate),
      display: `${(parseFloat(m.failure_rate) * 100).toFixed(0)}%`,
    }))
    .sort((a, b) => b.value - a.value);

  const stabilityItems = performance
    .filter((m) => m.avg_stability_score != null)
    .map((m) => ({
      key: m.model,
      label: modelDisplayName(m.model),
      value: parseFloat(m.avg_stability_score),
      display: `${(parseFloat(m.avg_stability_score) * 100).toFixed(0)}%`,
    }))
    .sort((a, b) => b.value - a.value);

  // ─── New Analytics (Steps 4-6) ────────────────────────────

  // Insight Engine
  const insights = generateInsights(performance, failures);

  // Token Analysis (Step 4)
  const tokenStats = records.length > 0 ? computeTokenStatsByModel(records) : [];
  const tokenItems = tokenStats.slice(0, 20).map((s) => ({
    key: s.model,
    label: modelDisplayName(s.model),
    value: s.avgTokens,
    display: `${s.avgTokens}`,
  }));
  const maxTokens = tokenItems[0]?.value || 0;

  // Length-Hallucination correlation (Step 4)
  const lengthCorr = records.length > 0 ? computeLengthHallucinationCorrelation(records) : null;

  // Calibration Analysis (Step 5)
  const calibration = records.length > 0 ? computeCalibrationByModel(records) : [];
  const calibrationItems = calibration.slice(0, 20).map((c) => ({
    key: c.model,
    label: modelDisplayName(c.model),
    value: c.avgCalibrationError,
    display: `${(c.avgCalibrationError * 100).toFixed(0)}%`,
  }));
  const maxCalibration = calibrationItems.length > 0 ? Math.max(...calibrationItems.map((i) => i.value)) : 1;

  // Failure pattern co-occurrence (Step 2)
  const failurePatternData = records.length > 0 ? aggregateFailurePatterns(records) : null;
  const coOccurrenceItems = failurePatternData
    ? Object.entries(failurePatternData.coOccurrence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([combo, count]) => ({
          label: combo.replace(/_/g, " "),
          value: count,
          display: String(count),
        }))
    : [];
  const maxCoOcc = coOccurrenceItems[0]?.value || 0;

  // Hallucination rate by model (from failure summary)
  const hallByModel = {};
  const totalByModel = {};
  for (const f of failures) {
    totalByModel[f.model] = (totalByModel[f.model] || 0) + f.occurrence_count;
    if (f.failure_type === "hallucination") {
      hallByModel[f.model] = (hallByModel[f.model] || 0) + f.occurrence_count;
    }
  }
  const hallucinationItems = Object.entries(hallByModel)
    .map(([model, count]) => ({
      key: model,
      label: modelDisplayName(model),
      value: totalByModel[model] > 0 ? count / totalByModel[model] : 0,
      display: `${((count / (totalByModel[model] || 1)) * 100).toFixed(0)}%`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

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
          Model performance, failure patterns, calibration, and generated insights.
        </p>
      </div>

      {/* Insight Engine (Step 6) */}
      {insights.length > 0 && (
        <section className="bg-gray-900 border border-amber-800/30 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Top Insights
          </h2>
          <p className="text-xs text-gray-500">Auto-generated findings from the dataset.</p>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Model Truth Scores */}
      {truthItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Average Truth Score by Model</h2>
          <p className="text-xs text-gray-500">Higher is better. Based on factual claim verification.</p>
          <BarChart items={truthItems} maxValue={1} colorClass="bg-green-400" />
        </section>
      )}

      {/* Hallucination Rate by Model (Step 7) */}
      {hallucinationItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Hallucination Rate by Model</h2>
          <p className="text-xs text-gray-500">Proportion of detected failures that are hallucinations. Lower is better.</p>
          <BarChart items={hallucinationItems} maxValue={1} colorClass="bg-rose-400" />
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

      {/* Failure Pattern Co-occurrence (Step 2) */}
      {coOccurrenceItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Failure Pattern Co-occurrence</h2>
          <p className="text-xs text-gray-500">
            Secondary failure patterns detected alongside primary failures via linguistic heuristics.
          </p>
          <BarChart items={coOccurrenceItems} maxValue={maxCoOcc} colorClass="bg-purple-400" />
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

      {/* Average Response Length (Step 4) */}
      {tokenItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Average Response Length by Model</h2>
          <p className="text-xs text-gray-500">Estimated tokens per response. Approximated client-side.</p>
          <BarChart items={tokenItems} maxValue={maxTokens} colorClass="bg-cyan-400" />
        </section>
      )}

      {/* Length vs Hallucination (Step 4) */}
      {lengthCorr && lengthCorr.buckets.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Response Length vs Hallucination Rate</h2>
          <p className="text-xs text-gray-500">
            Correlation: r = {lengthCorr.correlation.toFixed(2)}.{" "}
            {Math.abs(lengthCorr.correlation) < 0.1
              ? "No meaningful correlation."
              : lengthCorr.correlation > 0
              ? "Longer responses tend to hallucinate more."
              : "Shorter responses tend to hallucinate more."}
          </p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {lengthCorr.buckets.map((b) => (
              <div key={b.label} className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{b.label} tokens</div>
                <div className="text-sm font-mono text-rose-400">{(b.hallucinationRate * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-600">{b.count} responses</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confidence Calibration (Step 5) */}
      {calibrationItems.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Confidence Calibration Error by Model</h2>
          <p className="text-xs text-gray-500">
            |estimated confidence - actual truth score|. Lower is better.
            A well-calibrated model is confident when correct and uncertain when wrong.
          </p>
          <BarChart items={calibrationItems} maxValue={maxCalibration || 1} colorClass="bg-orange-400" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1 pr-3">Model</th>
                  <th className="text-right py-1 px-2">Avg Confidence</th>
                  <th className="text-right py-1 px-2">Avg Truth</th>
                  <th className="text-right py-1 px-2">Cal. Error</th>
                  <th className="text-left py-1 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {calibration.slice(0, 15).map((c) => (
                  <tr key={c.model} className="border-b border-gray-800/30">
                    <td className="py-1 pr-3 text-gray-300">{modelDisplayName(c.model)}</td>
                    <td className="text-right py-1 px-2 text-gray-400">{(c.avgConfidence * 100).toFixed(0)}%</td>
                    <td className="text-right py-1 px-2 text-gray-400">{(c.avgTruth * 100).toFixed(0)}%</td>
                    <td className="text-right py-1 px-2 font-mono text-orange-400">{(c.avgCalibrationError * 100).toFixed(0)}%</td>
                    <td className="py-1 px-2">
                      <span className={c.isOverconfident ? "text-red-400" : "text-green-400"}>
                        {c.isOverconfident ? "overconfident" : "calibrated"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Summary Stats Table */}
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
