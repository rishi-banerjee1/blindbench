/**
 * Prompt perturbation classification (frontend-only).
 *
 * The backend generates prompt variants via GPT-4o.
 * This module classifies perturbation TYPE by comparing original vs variant text.
 *
 * Categories:
 *   - instruction_amplification: variant adds emphasis/clarification
 *   - instruction_reduction: variant simplifies/removes detail
 *   - tone_shift: variant changes formality/politeness
 *   - constraint_injection: variant adds new constraints/conditions
 *   - verbosity_change: variant is significantly longer or shorter
 */

// ─── Text Metrics ───────────────────────────────────────────

function wordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

function sentenceCount(text) {
  return (text || "").split(/[.!?]+/).filter(Boolean).length;
}

function questionCount(text) {
  return ((text || "").match(/\?/g) || []).length;
}

function hasConstraintWords(text) {
  return /\b(must|should|only|exactly|no more than|at least|ensure|require|limit|restrict|always|never)\b/i.test(text);
}

function formalityScore(text) {
  const formal = (text.match(/\b(please|kindly|would you|could you|respectfully|furthermore|moreover)\b/gi) || []).length;
  const informal = (text.match(/\b(hey|yo|ok|yeah|gonna|wanna|stuff|thing|kinda|sorta)\b/gi) || []).length;
  return formal - informal;
}

// ─── Classification ─────────────────────────────────────────

/**
 * Classify the type of perturbation between original and variant.
 *
 * @param {string} original - Original prompt text
 * @param {string} variant - Perturbed variant text
 * @returns {{type: string, confidence: number, metrics: Object}}
 */
export function classifyPerturbation(original, variant) {
  const origWords = wordCount(original);
  const varWords = wordCount(variant);
  const lengthRatio = varWords / Math.max(origWords, 1);

  const origConstraints = hasConstraintWords(original);
  const varConstraints = hasConstraintWords(variant);

  const origFormality = formalityScore(original);
  const varFormality = formalityScore(variant);
  const formalityDelta = varFormality - origFormality;

  const origQuestions = questionCount(original);
  const varQuestions = questionCount(variant);

  const metrics = {
    lengthRatio: Math.round(lengthRatio * 100) / 100,
    origWords,
    varWords,
    formalityDelta,
    constraintAdded: !origConstraints && varConstraints,
    questionDelta: varQuestions - origQuestions,
  };

  // Classify by strongest signal
  const scores = [];

  // Verbosity change: >40% length difference
  if (Math.abs(lengthRatio - 1) > 0.4) {
    scores.push({
      type: "verbosity_change",
      confidence: Math.min(Math.abs(lengthRatio - 1), 1),
    });
  }

  // Constraint injection: new constraint words in variant
  if (!origConstraints && varConstraints) {
    scores.push({ type: "constraint_injection", confidence: 0.8 });
  }

  // Tone shift: formality changed significantly
  if (Math.abs(formalityDelta) >= 2) {
    scores.push({
      type: "tone_shift",
      confidence: Math.min(Math.abs(formalityDelta) / 4, 1),
    });
  }

  // Instruction amplification: variant is longer with more detail
  if (lengthRatio > 1.15 && lengthRatio <= 1.4) {
    scores.push({ type: "instruction_amplification", confidence: 0.6 });
  }

  // Instruction reduction: variant is shorter with less detail
  if (lengthRatio < 0.85 && lengthRatio >= 0.6) {
    scores.push({ type: "instruction_reduction", confidence: 0.6 });
  }

  // Default: if no strong signal, classify by length direction
  if (scores.length === 0) {
    if (lengthRatio > 1.05) {
      scores.push({ type: "instruction_amplification", confidence: 0.3 });
    } else if (lengthRatio < 0.95) {
      scores.push({ type: "instruction_reduction", confidence: 0.3 });
    } else {
      scores.push({ type: "tone_shift", confidence: 0.3 });
    }
  }

  // Return highest-confidence classification
  scores.sort((a, b) => b.confidence - a.confidence);
  return { ...scores[0], metrics };
}

/**
 * Analyze a batch of perturbation results.
 *
 * @param {string} originalPrompt - The original prompt text
 * @param {{variant_text: string, sensitivity_score?: number}[]} variants
 * @returns {{classifications: Array, distribution: Object, avgSensitivityByType: Object}}
 */
export function analyzePerturbations(originalPrompt, variants) {
  if (!variants || variants.length === 0) {
    return { classifications: [], distribution: {}, avgSensitivityByType: {} };
  }

  const classifications = variants.map((v) => ({
    variant: v.variant_text,
    ...classifyPerturbation(originalPrompt, v.variant_text),
    sensitivityScore: v.sensitivity_score ?? null,
  }));

  // Distribution of perturbation types
  const distribution = {};
  const sensitivityByType = {};

  for (const c of classifications) {
    distribution[c.type] = (distribution[c.type] || 0) + 1;
    if (c.sensitivityScore != null) {
      if (!sensitivityByType[c.type]) sensitivityByType[c.type] = [];
      sensitivityByType[c.type].push(c.sensitivityScore);
    }
  }

  // Average sensitivity per perturbation type
  const avgSensitivityByType = {};
  for (const [type, scores] of Object.entries(sensitivityByType)) {
    avgSensitivityByType[type] =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000;
  }

  return { classifications, distribution, avgSensitivityByType };
}

/**
 * Pretty label for perturbation type.
 */
export function perturbationLabel(type) {
  const labels = {
    instruction_amplification: "Instruction Amplification",
    instruction_reduction: "Instruction Reduction",
    tone_shift: "Tone Shift",
    constraint_injection: "Constraint Injection",
    verbosity_change: "Verbosity Change",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
