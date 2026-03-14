/**
 * Confidence calibration analysis (frontend heuristic).
 *
 * Estimates how confident a response SOUNDS using linguistic markers,
 * then compares with the actual truth_score to measure calibration.
 *
 * A well-calibrated model is confident when correct and uncertain when wrong.
 * confidence_calibration_error = |estimated_confidence - truth_score|
 *
 * No backend evaluator calls — pure text analysis.
 */

// ─── Confidence Estimation ──────────────────────────────────

const HIGH_CONFIDENCE = [
  /\bdefinitely\b/i, /\bcertainly\b/i, /\babsolutely\b/i,
  /\bwithout a doubt\b/i, /\bthe answer is\b/i, /\bclearly\b/i,
  /\bundoubtedly\b/i, /\bno question\b/i, /\bin fact\b/i,
  /\bguaranteed\b/i, /\bwithout exception\b/i, /\bproven\b/i,
  /\bestablished fact\b/i, /\bscientifically\b/i,
];

const LOW_CONFIDENCE = [
  /\bperhaps\b/i, /\bmaybe\b/i, /\bpossibly\b/i,
  /\bmight\b/i, /\bcould be\b/i, /\bi think\b/i,
  /\bi believe\b/i, /\bit seems\b/i, /\bi'm not sure\b/i,
  /\bi'm uncertain\b/i, /\bto my knowledge\b/i,
  /\bapproximately\b/i, /\broughly\b/i, /\bestimated\b/i,
  /\bnot entirely clear\b/i, /\bdebatable\b/i,
];

const DISCLAIMER = [
  /\bhowever\b/i, /\bthat said\b/i, /\bon the other hand\b/i,
  /\bit's worth noting\b/i, /\bimportant to note\b/i,
  /\bi should mention\b/i, /\bcaveat\b/i,
];

/**
 * Estimate confidence level of a response (0-1).
 * Purely based on linguistic markers.
 *
 * @param {string} text - Response text
 * @returns {{confidence: number, highMarkers: number, lowMarkers: number, disclaimers: number}}
 */
export function estimateConfidence(text) {
  if (!text) return { confidence: 0.5, highMarkers: 0, lowMarkers: 0, disclaimers: 0 };

  let highCount = 0;
  for (const p of HIGH_CONFIDENCE) {
    const matches = text.match(new RegExp(p.source, p.flags + "g"));
    if (matches) highCount += matches.length;
  }

  let lowCount = 0;
  for (const p of LOW_CONFIDENCE) {
    const matches = text.match(new RegExp(p.source, p.flags + "g"));
    if (matches) lowCount += matches.length;
  }

  let disclaimerCount = 0;
  for (const p of DISCLAIMER) {
    const matches = text.match(new RegExp(p.source, p.flags + "g"));
    if (matches) disclaimerCount += matches.length;
  }

  // Compute confidence score
  const totalMarkers = highCount + lowCount + disclaimerCount;
  if (totalMarkers === 0) return { confidence: 0.5, highMarkers: 0, lowMarkers: 0, disclaimers: 0 };

  // Base confidence from marker ratio
  const highRatio = highCount / totalMarkers;
  const lowRatio = (lowCount + disclaimerCount) / totalMarkers;

  // Score: 0.5 is neutral, shifts toward 1 (confident) or 0 (uncertain)
  const confidence = Math.round((0.5 + (highRatio - lowRatio) * 0.5) * 1000) / 1000;
  const clamped = Math.max(0, Math.min(1, confidence));

  return {
    confidence: clamped,
    highMarkers: highCount,
    lowMarkers: lowCount,
    disclaimers: disclaimerCount,
  };
}

/**
 * Compute calibration error for a single record.
 * |estimated_confidence - truth_score|
 *
 * @param {string} responseText
 * @param {number|null} truthScore - 0 to 1
 * @returns {number|null} Calibration error, or null if no truth score
 */
export function calibrationError(responseText, truthScore) {
  if (truthScore == null) return null;
  const { confidence } = estimateConfidence(responseText);
  return Math.round(Math.abs(confidence - truthScore) * 1000) / 1000;
}

/**
 * Compute per-model calibration statistics.
 *
 * @param {Array<{model: string, response_text: string, truth_score?: number}>} records
 * @returns {Array<{model: string, avgCalibrationError: number, avgConfidence: number, avgTruth: number, count: number, isOverconfident: boolean}>}
 */
export function computeCalibrationByModel(records) {
  const byModel = {};

  for (const r of records) {
    if (r.truth_score == null || !r.response_text) continue;

    const { confidence } = estimateConfidence(r.response_text);
    const error = Math.abs(confidence - r.truth_score);

    if (!byModel[r.model]) byModel[r.model] = { errors: [], confidences: [], truths: [] };
    byModel[r.model].errors.push(error);
    byModel[r.model].confidences.push(confidence);
    byModel[r.model].truths.push(r.truth_score);
  }

  return Object.entries(byModel)
    .map(([model, data]) => {
      const avgError = data.errors.reduce((a, b) => a + b, 0) / data.errors.length;
      const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
      const avgTruth = data.truths.reduce((a, b) => a + b, 0) / data.truths.length;

      return {
        model,
        avgCalibrationError: Math.round(avgError * 1000) / 1000,
        avgConfidence: Math.round(avgConf * 1000) / 1000,
        avgTruth: Math.round(avgTruth * 1000) / 1000,
        count: data.errors.length,
        isOverconfident: avgConf > avgTruth + 0.1,
      };
    })
    .sort((a, b) => a.avgCalibrationError - b.avgCalibrationError);
}
