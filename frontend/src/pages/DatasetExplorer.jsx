import { useState, useEffect, Fragment } from "react";
import { fetchEvaluationRecords, exportDataset } from "../services/api";
import { modelDisplayName } from "../utils/models";
import { estimateTokens } from "../analytics/tokenAnalysis";
import { estimateConfidence, calibrationError } from "../analytics/calibrationAnalysis";
import { detectFailurePatterns } from "../analytics/failurePatterns";

const PAGE_SIZE = 25;

export default function DatasetExplorer() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchEvaluationRecords(PAGE_SIZE, page * PAGE_SIZE);
        if (!cancelled) setRecords(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [page]);

  function enrichRecord(r) {
    const tokens = estimateTokens(r.response_text);
    const confResult = estimateConfidence(r.response_text);
    const calError = calibrationError(r.response_text, r.truth_score);
    const secondaryPatterns = detectFailurePatterns(r.response_text, r.failure_type);
    return {
      ...r,
      response_token_estimate: tokens,
      estimated_confidence: confResult.confidence,
      confidence_calibration_error: calError,
      secondary_failure_patterns: secondaryPatterns.map((p) => p.pattern).join(", ") || null,
    };
  }

  async function handleExport(format, enriched = false) {
    setExporting(true);
    setError(null);
    try {
      const data = await exportDataset("json", { limit: 1000 });
      const output = enriched ? data.map(enrichRecord) : data;

      if (format === "csv") {
        const headers = enriched
          ? ["prompt_id","prompt_text","model","response_text","truth_score","failure_type","stability_score","total_votes","votes_won","won_vote","response_token_estimate","estimated_confidence","confidence_calibration_error","secondary_failure_patterns","prompt_created_at"]
          : ["prompt_id","prompt_text","model","response_text","truth_score","failure_type","stability_score","total_votes","votes_won","won_vote","prompt_created_at"];
        const escape = (v) => {
          const s = v == null ? "" : String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const rows = [headers.join(","), ...output.map((r) => headers.map((h) => escape(r[h])).join(","))];
        const content = rows.join("\n");
        downloadBlob(content, "text/csv", `blindbench_${enriched ? "enriched" : "export"}.csv`);
      } else {
        const content = JSON.stringify(output, null, 2);
        downloadBlob(content, "application/json", `blindbench_${enriched ? "enriched" : "export"}.json`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  function downloadBlob(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function truncate(text, maxLen = 80) {
    if (!text) return "";
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dataset Explorer</h1>
        <p className="text-gray-400 text-sm">
          Browse evaluation records and export datasets for research.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Page {page + 1} &middot; Showing up to {PAGE_SIZE} records
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {exporting ? "Exporting..." : "Export JSON"}
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => handleExport("json", true)}
            disabled={exporting}
            className="px-4 py-2 text-xs bg-amber-900/30 text-amber-400 rounded-md hover:bg-amber-900/50 disabled:opacity-40 transition-colors"
            title="Includes derived metrics: token estimates, confidence calibration, secondary failure patterns"
          >
            {exporting ? "Exporting..." : "Export Enriched JSON"}
          </button>
          <button
            onClick={() => handleExport("csv", true)}
            disabled={exporting}
            className="px-4 py-2 text-xs bg-amber-900/30 text-amber-400 rounded-md hover:bg-amber-900/50 disabled:opacity-40 transition-colors"
            title="Includes derived metrics: token estimates, confidence calibration, secondary failure patterns"
          >
            {exporting ? "Exporting..." : "Export Enriched CSV"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading records...</div>
      ) : records.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No evaluation records yet. Submit prompts in the Arena to generate data.
        </div>
      ) : (
        <>
          {/* Records Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800 bg-gray-900/50">
                    <th className="text-left py-3 px-4">Prompt</th>
                    <th className="text-left py-3 px-3">Model</th>
                    <th className="text-right py-3 px-3">Truth</th>
                    <th className="text-left py-3 px-3">Failure</th>
                    <th className="text-right py-3 px-3">Stability</th>
                    <th className="text-center py-3 px-3">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <Fragment key={`${r.response_id}-${i}`}>
                      <tr
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      >
                        <td className="py-2 px-4 text-gray-300 max-w-xs truncate" title={r.prompt_text}>
                          {truncate(r.prompt_text, 60)}
                        </td>
                        <td className="py-2 px-3 font-medium">{modelDisplayName(r.model)}</td>
                        <td className="text-right py-2 px-3">
                          {r.truth_score != null ? (
                            <span className={
                              r.truth_score >= 0.7 ? "text-green-400" :
                              r.truth_score >= 0.4 ? "text-yellow-400" :
                              "text-red-400"
                            }>
                              {(r.truth_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.failure_type ? (
                            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                              {r.failure_type.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">none</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3">
                          {r.stability_score != null ? (
                            <span className="text-blue-400">{(r.stability_score * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-3">
                          {r.total_votes > 0 ? (
                            <span className={r.won_vote ? "text-green-400 text-xs" : "text-gray-500 text-xs"}>
                              {r.votes_won}/{r.total_votes}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                      {expandedRow === i && (() => {
                        const tokens = estimateTokens(r.response_text);
                        const conf = estimateConfidence(r.response_text);
                        const calErr = calibrationError(r.response_text, r.truth_score);
                        const patterns = detectFailurePatterns(r.response_text, r.failure_type);
                        return (
                          <tr key={`expanded-${i}`} className="bg-gray-800/20">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <span className="text-gray-400 font-medium">Full prompt: </span>
                                  <span className="text-gray-300">{r.prompt_text}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-medium">Response: </span>
                                  <span className="text-gray-300">{truncate(r.response_text, 500)}</span>
                                </div>
                                <div className="flex gap-4 pt-1 border-t border-gray-800/50">
                                  <span className="text-gray-500">~{tokens} tokens</span>
                                  <span className="text-gray-500">Confidence: <span className="text-orange-400">{(conf.confidence * 100).toFixed(0)}%</span></span>
                                  {calErr != null && <span className="text-gray-500">Cal. error: <span className="text-orange-400">{(calErr * 100).toFixed(0)}%</span></span>}
                                  {patterns.length > 0 && (
                                    <span className="text-gray-500">
                                      Secondary: {patterns.map((p) => (
                                        <span key={p.pattern} className="text-purple-400 ml-1">{p.pattern.replace(/_/g, " ")}</span>
                                      ))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={records.length < PAGE_SIZE}
              className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
