import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard } from "../services/api";
import { escapeHtml } from "../utils/sanitize";
import { modelDisplayName } from "../utils/models";

/**
 * Categorize a model by its primary use based on its ID/name.
 */
function modelCategory(modelId) {
  const id = modelId.toLowerCase();
  if (id.includes("code") || id.includes("coder") || id.includes("codex"))
    return { label: "Code", color: "bg-blue-900/30 text-blue-400 border-blue-800" };
  if (id.includes("vision") || id.includes("vl") || id.includes("omni"))
    return { label: "Vision", color: "bg-purple-900/30 text-purple-400 border-purple-800" };
  if (id.includes("embed") || id.includes("embedding"))
    return { label: "Embedding", color: "bg-cyan-900/30 text-cyan-400 border-cyan-800" };
  if (id.includes("mini") || id.includes("nano") || id.includes("tiny") || id.includes("small") || id.includes("lite"))
    return { label: "Lightweight", color: "bg-green-900/30 text-green-400 border-green-800" };
  if (id.includes("think") || id.includes("reason"))
    return { label: "Reasoning", color: "bg-amber-900/30 text-amber-400 border-amber-800" };
  if (id.includes("fast") || id.includes("flash") || id.includes("turbo") || id.includes("speed"))
    return { label: "Speed", color: "bg-orange-900/30 text-orange-400 border-orange-800" };
  if (id.includes("pro") || id.includes("opus") || id.includes("ultra") || id.includes("xhigh") || id.includes("high"))
    return { label: "Premium", color: "bg-rose-900/30 text-rose-400 border-rose-800" };
  return { label: "General", color: "bg-gray-800 text-gray-400 border-gray-700" };
}

/**
 * Extract creator/provider from model ID.
 */
function modelProvider(modelId) {
  const parts = modelId.split("/");
  if (parts.length < 2) return "Unknown";
  return parts[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORIES = [
  "All",
  "General",
  "Premium",
  "Speed",
  "Lightweight",
  "Code",
  "Vision",
  "Reasoning",
];

export default function AllModels() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchLeaderboard();
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

  const filtered = data.filter((row) => {
    const cat = modelCategory(row.model);
    const matchesCat = filterCat === "All" || cat.label === filterCat;
    const matchesSearch =
      !search ||
      modelDisplayName(row.model).toLowerCase().includes(search.toLowerCase()) ||
      modelProvider(row.model).toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link
            to="/leaderboard"
            className="text-gray-400 hover:text-white text-sm"
          >
            Leaderboard
          </Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-2xl font-bold">All Models</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Full rankings across {data.length} models from blind comparisons.
        </p>
      </div>

      {loading && (
        <div className="text-gray-500 text-sm py-8 text-center">
          Loading model data...
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* Search + filters */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search models or providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
            />
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterCat === cat
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Showing {filtered.length} of {data.length} models
          </p>

          {/* Full table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Wins</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Win Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const globalRank =
                    data.findIndex((d) => d.model === row.model) + 1;
                  const cat = modelCategory(row.model);
                  const medal =
                    globalRank === 1
                      ? "text-amber-400"
                      : globalRank === 2
                      ? "text-gray-300"
                      : globalRank === 3
                      ? "text-orange-400"
                      : "text-gray-500";
                  return (
                    <tr
                      key={row.model}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className={`px-4 py-3 font-mono ${medal}`}>
                        #{globalRank}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {escapeHtml(modelDisplayName(row.model))}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {modelProvider(row.model)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${cat.color}`}
                        >
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {row.total_wins}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono ${
                            globalRank <= 3
                              ? "text-amber-400"
                              : "text-gray-400"
                          }`}
                        >
                          {row.win_rate_pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-gray-600 text-center">
        Data from 4 Kaggle datasets (LLM EvaluationHub, Prompt Engineering, AI
        Models Benchmark 2026). Live results update as users submit prompts and
        vote.
      </p>
    </div>
  );
}
