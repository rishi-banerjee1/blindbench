import { useState, useEffect } from "react";
import { fetchModelPerformance, fetchFailureSummary, fetchLeaderboard } from "../services/api";
import { modelDisplayName } from "../utils/models";

// ── Stat Card ────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Finding Card ─────────────────────────────────────────

function Finding({ icon, title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-2">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function pct(val) {
  if (val == null) return "—";
  return `${(parseFloat(val) * 100).toFixed(1)}%`;
}

function topN(arr, key, n = 3) {
  return [...arr]
    .filter((m) => m[key] != null)
    .sort((a, b) => parseFloat(b[key]) - parseFloat(a[key]))
    .slice(0, n);
}

function bottomN(arr, key, n = 3) {
  return [...arr]
    .filter((m) => m[key] != null)
    .sort((a, b) => parseFloat(a[key]) - parseFloat(b[key]))
    .slice(0, n);
}

// ── Main Component ──────────────────────────────────────

export default function Insights() {
  const [perf, setPerf] = useState([]);
  const [failures, setFailures] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [p, f, l] = await Promise.allSettled([
          fetchModelPerformance(),
          fetchFailureSummary(),
          fetchLeaderboard(),
        ]);
        if (cancelled) return;
        if (p.status === "fulfilled") setPerf(p.value || []);
        if (f.status === "fulfilled") setFailures(f.value || []);
        if (l.status === "fulfilled") setLeaders(l.value || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-sm py-8 text-center">Computing insights...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  // ── Compute insights from raw data ──

  const totalModels = perf.length;
  const totalResponses = perf.reduce((s, m) => s + (m.total_responses || 0), 0);
  const totalVotes = leaders.reduce((s, m) => s + (m.total_wins || 0), 0);

  const avgTruthAll = perf.filter(m => m.avg_truth_score != null);
  const globalAvgTruth = avgTruthAll.length > 0
    ? avgTruthAll.reduce((s, m) => s + parseFloat(m.avg_truth_score), 0) / avgTruthAll.length
    : null;

  const avgFailureRateAll = perf.filter(m => m.failure_rate != null);
  const globalAvgFailureRate = avgFailureRateAll.length > 0
    ? avgFailureRateAll.reduce((s, m) => s + parseFloat(m.failure_rate), 0) / avgFailureRateAll.length
    : null;

  // Top performers
  const topTruth = topN(perf, "avg_truth_score", 5);
  const bottomTruth = bottomN(perf, "avg_truth_score", 3);
  const lowestFailureRate = bottomN(perf, "failure_rate", 5);
  const highestFailureRate = topN(perf, "failure_rate", 3);

  // Failure type distribution
  const failureByType = {};
  let totalFailureCount = 0;
  for (const row of failures) {
    if (!failureByType[row.failure_type]) failureByType[row.failure_type] = 0;
    failureByType[row.failure_type] += row.occurrence_count;
    totalFailureCount += row.occurrence_count;
  }
  const sortedFailureTypes = Object.entries(failureByType)
    .sort((a, b) => b[1] - a[1]);
  const topFailure = sortedFailureTypes[0];
  const topFailurePct = topFailure ? ((topFailure[1] / totalFailureCount) * 100).toFixed(1) : 0;

  // Vote leaders
  const topVoted = [...leaders].sort((a, b) => (b.total_wins || 0) - (a.total_wins || 0)).slice(0, 5);

  // Human preference vs truth correlation
  const voteMap = {};
  for (const v of leaders) voteMap[v.model] = parseFloat(v.win_rate_pct || 0);
  const modelsWithBoth = perf.filter(m => m.avg_truth_score != null && voteMap[m.model] != null);
  const truthVsVoteCorrelation = modelsWithBoth.length >= 5 ? computeCorrelation(
    modelsWithBoth.map(m => parseFloat(m.avg_truth_score)),
    modelsWithBoth.map(m => voteMap[m.model])
  ) : null;

  // Models with high truth but low votes (underrated)
  const underrated = modelsWithBoth
    .filter(m => parseFloat(m.avg_truth_score) > (globalAvgTruth || 0.5) && (voteMap[m.model] || 0) < 5)
    .sort((a, b) => parseFloat(b.avg_truth_score) - parseFloat(a.avg_truth_score))
    .slice(0, 3);

  // Models with high failure + high votes (overrated)
  const overrated = modelsWithBoth
    .filter(m => parseFloat(m.failure_rate) > 0.5 && (voteMap[m.model] || 0) > 3)
    .sort((a, b) => parseFloat(b.failure_rate) - parseFloat(a.failure_rate))
    .slice(0, 3);

  // Failure type breakdown for narrative
  const failureNarrative = sortedFailureTypes.slice(0, 3).map(([type, count]) => ({
    type: type.replace(/_/g, " "),
    count,
    pct: ((count / totalFailureCount) * 100).toFixed(1),
  }));

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Research Insights</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          A synthesized view of BlindBench evaluation data. These findings are auto-computed
          from blind human voting, automated factual accuracy scoring, and reasoning failure
          classification across {totalModels} models.
        </p>
      </div>

      {/* At a Glance */}
      <section>
        <h2 className="text-lg font-semibold mb-3">At a Glance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Models Evaluated" value={totalModels} />
          <StatCard
            label="Total Responses"
            value={totalResponses.toLocaleString()}
            sub="primary runs only"
          />
          <StatCard
            label="Avg Factual Accuracy"
            value={globalAvgTruth != null ? pct(globalAvgTruth) : "—"}
            color={globalAvgTruth >= 0.6 ? "text-green-400" : "text-yellow-400"}
            sub="across all models"
          />
          <StatCard
            label="Avg Failure Rate"
            value={globalAvgFailureRate != null ? pct(globalAvgFailureRate) : "—"}
            color={globalAvgFailureRate <= 0.5 ? "text-yellow-400" : "text-red-400"}
            sub="responses with reasoning errors"
          />
        </div>
      </section>

      {/* Key Findings */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Key Findings</h2>
        <div className="grid md:grid-cols-2 gap-4">

          {/* Finding 1: Most Accurate Models */}
          {topTruth.length > 0 && (
            <Finding icon="1" title="Most Factually Accurate">
              <p>
                The highest truth scores belong to models that consistently make
                verifiable claims:
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-gray-300">
                {topTruth.map((m) => (
                  <li key={m.model}>
                    <span className="font-medium text-white">{modelDisplayName(m.model)}</span>
                    {" "}<span className="text-green-400">{pct(m.avg_truth_score)}</span>
                    <span className="text-gray-500 text-xs"> ({m.total_responses} responses)</span>
                  </li>
                ))}
              </ol>
              {bottomTruth.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Lowest: {bottomTruth.map(m => `${modelDisplayName(m.model)} (${pct(m.avg_truth_score)})`).join(", ")}
                </p>
              )}
            </Finding>
          )}

          {/* Finding 2: Dominant Failure Mode */}
          {topFailure && (
            <Finding icon="2" title="Dominant Failure Mode">
              <p>
                The most common reasoning failure is{" "}
                <span className="text-red-400 font-medium">{topFailure[0].replace(/_/g, " ")}</span>,
                accounting for <span className="text-white font-medium">{topFailurePct}%</span> of
                all detected failures ({topFailure[1].toLocaleString()} occurrences).
              </p>
              {failureNarrative.length > 1 && (
                <div className="mt-2">
                  <p className="text-gray-400 text-xs mb-1">Top 3 failure types:</p>
                  <div className="space-y-1">
                    {failureNarrative.map((f) => (
                      <div key={f.type} className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-red-400/70 rounded-full"
                            style={{ width: `${f.pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-32 truncate">{f.type}</span>
                        <span className="text-xs text-gray-500 w-10 text-right">{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Finding>
          )}

          {/* Finding 3: Lowest Failure Rates */}
          {lowestFailureRate.length > 0 && (
            <Finding icon="3" title="Most Reliable Reasoners">
              <p>
                These models produce the fewest reasoning failures per response:
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-gray-300">
                {lowestFailureRate.map((m) => (
                  <li key={m.model}>
                    <span className="font-medium text-white">{modelDisplayName(m.model)}</span>
                    {" "}<span className="text-green-400">{pct(m.failure_rate)} failure rate</span>
                  </li>
                ))}
              </ol>
              {highestFailureRate.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Most failure-prone: {highestFailureRate.map(m => `${modelDisplayName(m.model)} (${pct(m.failure_rate)})`).join(", ")}
                </p>
              )}
            </Finding>
          )}

          {/* Finding 4: Human Preference vs Truth */}
          <Finding icon="4" title="Human Preference vs Factual Accuracy">
            {truthVsVoteCorrelation != null ? (
              <p>
                The correlation between human voting preference and factual accuracy
                is <span className={`font-medium ${Math.abs(truthVsVoteCorrelation) > 0.3 ? "text-yellow-400" : "text-gray-300"}`}>
                  r = {truthVsVoteCorrelation.toFixed(2)}
                </span>.{" "}
                {Math.abs(truthVsVoteCorrelation) < 0.3
                  ? "This suggests humans do not reliably prefer more factually accurate models in blind tests — style and confidence may matter more than correctness."
                  : Math.abs(truthVsVoteCorrelation) > 0.6
                  ? "This strong correlation indicates humans tend to prefer models that are also more factually accurate."
                  : "This moderate correlation suggests factual accuracy partially influences human preference, but other factors (style, verbosity, confidence) also play a role."
                }
              </p>
            ) : (
              <p>
                Insufficient vote data to compute correlation between human preference and factual
                accuracy. Vote in the Arena to generate this insight.
              </p>
            )}
            {topVoted.length > 0 && (
              <div className="mt-2">
                <p className="text-gray-400 text-xs mb-1">Top voted models (blind comparison):</p>
                <div className="flex flex-wrap gap-2">
                  {topVoted.map((m) => (
                    <span key={m.model} className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded">
                      {modelDisplayName(m.model)} ({m.total_wins} wins)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Finding>
        </div>
      </section>

      {/* Underrated / Overrated */}
      {(underrated.length > 0 || overrated.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Preference-Accuracy Gaps</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {underrated.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">Underrated by Humans</h3>
                <p className="text-xs text-gray-400 mb-3">
                  High factual accuracy but low vote share — humans may undervalue these models.
                </p>
                {underrated.map((m) => (
                  <div key={m.model} className="flex items-center justify-between py-1 border-b border-gray-800/50 last:border-0">
                    <span className="text-sm">{modelDisplayName(m.model)}</span>
                    <span className="text-xs text-green-400">{pct(m.avg_truth_score)} truth</span>
                  </div>
                ))}
              </div>
            )}
            {overrated.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-red-400 mb-2">Overrated by Humans</h3>
                <p className="text-xs text-gray-400 mb-3">
                  High vote share but high failure rate — humans may be fooled by confident but faulty reasoning.
                </p>
                {overrated.map((m) => (
                  <div key={m.model} className="flex items-center justify-between py-1 border-b border-gray-800/50 last:border-0">
                    <span className="text-sm">{modelDisplayName(m.model)}</span>
                    <span className="text-xs text-red-400">{pct(m.failure_rate)} failure rate</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Failure Landscape */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Failure Landscape</h2>
        <p className="text-sm text-gray-400 mb-4">
          Distribution of the 10 reasoning failure types across all evaluated models.
          Each failure was classified by GPT-4o using a versioned taxonomy.
        </p>
        <div className="space-y-2">
          {sortedFailureTypes.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-40 text-right truncate" title={type.replace(/_/g, " ")}>
                {type.replace(/_/g, " ")}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-red-400/60 rounded-full transition-all"
                  style={{ width: `${totalFailureCount > 0 ? (count / sortedFailureTypes[0][1]) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-mono w-16 text-right">
                {count.toLocaleString()}
              </span>
              <span className="text-xs text-gray-600 w-12 text-right">
                {((count / totalFailureCount) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Methodology</h2>
        <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
          <div>
            <h3 className="text-gray-300 font-medium mb-1">Evaluation Pipeline</h3>
            <p>
              Each prompt is sent to all available models in parallel. Responses are stored
              with hidden model identities. Human evaluators choose the better response
              in a blind A/B comparison before model identities are revealed.
            </p>
          </div>
          <div>
            <h3 className="text-gray-300 font-medium mb-1">Factual Accuracy (Truth Score)</h3>
            <p>
              GPT-4o extracts verifiable factual claims from each response, then scores
              each claim as supported or unsupported. The truth score is the fraction
              of supported claims (0.0 = all claims wrong, 1.0 = all claims verified).
            </p>
          </div>
          <div>
            <h3 className="text-gray-300 font-medium mb-1">Reasoning Failure Classification</h3>
            <p>
              Each response is analyzed for 10 types of reasoning failures using a versioned
              taxonomy: hallucination, sycophancy, overconfidence, circular reasoning,
              false premise acceptance, failure to abstain, logical fallacy, contradiction,
              straw man, and anchoring bias.
            </p>
          </div>
          <div>
            <h3 className="text-gray-300 font-medium mb-1">Response Stability</h3>
            <p>
              Optional: the same prompt is run 3 times per model. Stability is measured
              as average pairwise Jaccard word-level similarity across runs (1.0 = identical
              responses every time).
            </p>
          </div>
          <div>
            <h3 className="text-gray-300 font-medium mb-1">Prompt Sensitivity</h3>
            <p>
              Optional: GPT-4o generates 2 semantic variants of each prompt (paraphrase
              and restructure). Sensitivity measures how much model answers change
              when the same question is phrased differently.
            </p>
          </div>
          <div className="pt-2 border-t border-gray-800">
            <h3 className="text-gray-300 font-medium mb-1">Limitations</h3>
            <p>
              Truth scoring is bounded by GPT-4o&apos;s own knowledge. Failure classification
              is single-label (one primary failure per response). Blind voting reflects
              individual evaluator preference, which may favor style over substance.
              All scores should be interpreted as relative, not absolute.
            </p>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="text-center text-xs text-gray-600 pb-4">
        Insights auto-generated from {totalResponses.toLocaleString()} responses across{" "}
        {totalModels} models. Data refreshes on page load.
      </div>
    </div>
  );
}

// ── Pearson correlation coefficient ─────────────────────

function computeCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}
