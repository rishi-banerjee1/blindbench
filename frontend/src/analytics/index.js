/**
 * BlindBench Analytics Module — barrel export.
 *
 * All modules operate on dataset records fetched from existing API.
 * No backend modifications required.
 */

export { computeStabilityScore, computeTfidfStability, computeEmbeddingStability, cosineSimilarity } from "./stabilityEmbedding";
export { detectFailurePatterns, aggregateFailurePatterns } from "./failurePatterns";
export { classifyPerturbation, analyzePerturbations, perturbationLabel } from "./perturbationAnalysis";
export { estimateTokens, computeTokenStatsByModel, computeLengthHallucinationCorrelation } from "./tokenAnalysis";
export { estimateConfidence, calibrationError, computeCalibrationByModel } from "./calibrationAnalysis";
export { generateInsights } from "./insightEngine";
