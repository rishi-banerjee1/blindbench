/**
 * Insight Engine — automatic finding generation from dataset records.
 *
 * Analyzes model performance data and produces human-readable insights.
 * Under 50 lines of core logic. Runs entirely in the browser.
 */

import { modelDisplayName } from "../utils/models";

/**
 * Generate automatic insights from model performance data.
 *
 * @param {Array<{model: string, avg_truth_score: number, failure_rate: number, avg_stability_score?: number, total_responses: number}>} performance
 * @param {Array<{failure_type: string, occurrence_count: number}>} failures
 * @returns {string[]} Array of human-readable insight strings
 */
export function generateInsights(performance, failures = []) {
  if (!performance || performance.length === 0) return [];

  const insights = [];
  const models = performance.filter((m) => m.total_responses >= 3);
  if (models.length === 0) return ["Not enough data to generate insights."];

  const name = (m) => modelDisplayName(m.model);
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  // 1. Most accurate model
  const byTruth = [...models].filter((m) => m.avg_truth_score != null).sort((a, b) => b.avg_truth_score - a.avg_truth_score);
  if (byTruth.length > 0) {
    const best = byTruth[0];
    const worst = byTruth[byTruth.length - 1];
    const gap = ((best.avg_truth_score - worst.avg_truth_score) * 100).toFixed(1);
    insights.push(`${name(best)} has the highest factual accuracy at ${pct(best.avg_truth_score)}, ${gap}pp ahead of ${name(worst)}.`);
  }

  // 2. Lowest hallucination rate
  const byFailure = [...models].filter((m) => m.failure_rate != null).sort((a, b) => a.failure_rate - b.failure_rate);
  if (byFailure.length > 0) {
    insights.push(`${name(byFailure[0])} shows the lowest failure rate at ${pct(byFailure[0].failure_rate)}.`);
  }

  // 3. Most stable model
  const byStability = [...models].filter((m) => m.avg_stability_score != null).sort((a, b) => b.avg_stability_score - a.avg_stability_score);
  if (byStability.length > 0) {
    insights.push(`${name(byStability[0])} responses are most stable across repeated runs (${pct(byStability[0].avg_stability_score)} consistency).`);
  }

  // 4. Dominant failure type
  const failureAgg = {};
  for (const f of failures) { failureAgg[f.failure_type] = (failureAgg[f.failure_type] || 0) + f.occurrence_count; }
  const topFailure = Object.entries(failureAgg).sort((a, b) => b[1] - a[1])[0];
  if (topFailure) {
    const total = Object.values(failureAgg).reduce((a, b) => a + b, 0);
    insights.push(`${topFailure[0].replace(/_/g, " ")} is the dominant failure mode (${((topFailure[1] / total) * 100).toFixed(0)}% of all failures).`);
  }

  // 5. Accuracy-failure gap
  if (byTruth.length >= 2 && byFailure.length >= 2) {
    const highTruthLowFail = models.find((m) => m.avg_truth_score > 0.7 && m.failure_rate < 0.3);
    if (highTruthLowFail) {
      insights.push(`${name(highTruthLowFail)} is both accurate (${pct(highTruthLowFail.avg_truth_score)}) and reliable (${pct(highTruthLowFail.failure_rate)} failure rate) — a strong all-rounder.`);
    }
  }

  // 6. Overconfident models (high failure rate but many responses)
  const overconfident = models.filter((m) => m.failure_rate > 0.5 && m.total_responses > 10);
  if (overconfident.length > 0) {
    insights.push(`${overconfident.map(name).join(", ")} ${overconfident.length === 1 ? "has" : "have"} failure rates above 50% — exercise caution for factual queries.`);
  }

  return insights;
}
