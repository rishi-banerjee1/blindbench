/**
 * Response length and token estimation (frontend-only).
 *
 * Approximates token counts without external API calls.
 * Uses the standard ~4 chars per token heuristic for English text,
 * refined with word/punctuation counting.
 *
 * Computes per-model averages and length-hallucination correlations.
 */

/**
 * Estimate token count for a text string.
 * Uses a hybrid heuristic: avg(char/4, words*1.3).
 * This closely approximates GPT tokenizer behavior for English.
 *
 * @param {string} text
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const charEstimate = Math.ceil(text.length / 4);
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordEstimate = Math.ceil(words * 1.3);
  return Math.round((charEstimate + wordEstimate) / 2);
}

/**
 * Compute per-model token statistics from evaluation records.
 *
 * @param {Array<{model: string, response_text: string, truth_score?: number, failure_type?: string}>} records
 * @returns {Array<{model: string, avgTokens: number, medianTokens: number, minTokens: number, maxTokens: number, count: number}>}
 */
export function computeTokenStatsByModel(records) {
  const byModel = {};

  for (const r of records) {
    if (!r.response_text) continue;
    const tokens = estimateTokens(r.response_text);
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(tokens);
  }

  return Object.entries(byModel)
    .map(([model, counts]) => {
      const sorted = [...counts].sort((a, b) => a - b);
      const sum = counts.reduce((a, b) => a + b, 0);
      return {
        model,
        avgTokens: Math.round(sum / counts.length),
        medianTokens: sorted[Math.floor(sorted.length / 2)],
        minTokens: sorted[0],
        maxTokens: sorted[sorted.length - 1],
        count: counts.length,
      };
    })
    .sort((a, b) => b.avgTokens - a.avgTokens);
}

/**
 * Compute correlation between response length and hallucination rate.
 * Groups responses into length buckets and computes failure rate per bucket.
 *
 * @param {Array<{response_text: string, failure_type?: string}>} records
 * @returns {{buckets: Array<{label: string, avgTokens: number, hallucinationRate: number, count: number}>, correlation: number}}
 */
export function computeLengthHallucinationCorrelation(records) {
  const withTokens = records
    .filter((r) => r.response_text)
    .map((r) => ({
      tokens: estimateTokens(r.response_text),
      isHallucination: r.failure_type === "hallucination",
      hasFailure: !!r.failure_type,
    }));

  if (withTokens.length === 0) return { buckets: [], correlation: 0 };

  // Create 5 equal-frequency buckets
  const sorted = [...withTokens].sort((a, b) => a.tokens - b.tokens);
  const bucketSize = Math.ceil(sorted.length / 5);
  const buckets = [];

  for (let i = 0; i < 5; i++) {
    const slice = sorted.slice(i * bucketSize, (i + 1) * bucketSize);
    if (slice.length === 0) continue;

    const avgTokens = Math.round(
      slice.reduce((a, b) => a + b.tokens, 0) / slice.length
    );
    const hallucinationRate =
      slice.filter((s) => s.isHallucination).length / slice.length;
    const failureRate = slice.filter((s) => s.hasFailure).length / slice.length;

    buckets.push({
      label: `${slice[0].tokens}-${slice[slice.length - 1].tokens}`,
      avgTokens,
      hallucinationRate: Math.round(hallucinationRate * 1000) / 1000,
      failureRate: Math.round(failureRate * 1000) / 1000,
      count: slice.length,
    });
  }

  // Pearson correlation: tokens vs hallucination boolean
  const xs = withTokens.map((r) => r.tokens);
  const ys = withTokens.map((r) => (r.isHallucination ? 1 : 0));
  const correlation = pearsonR(xs, ys);

  return { buckets, correlation };
}

/**
 * Pearson correlation coefficient.
 */
function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
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
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}
