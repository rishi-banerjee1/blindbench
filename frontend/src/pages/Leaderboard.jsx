import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard } from "../services/api";
import { escapeHtml } from "../utils/sanitize";
import { modelDisplayName } from "../utils/models";

function LeaderboardTable({ rows, startRank = 1, showMedal = false }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400">
            <th className="px-4 py-3 text-left font-medium">Rank</th>
            <th className="px-4 py-3 text-left font-medium">Model</th>
            <th className="px-4 py-3 text-right font-medium">Wins</th>
            <th className="px-4 py-3 text-right font-medium">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rank = startRank + i;
            const medal =
              showMedal && rank === 1
                ? "text-amber-400"
                : showMedal && rank === 2
                ? "text-gray-300"
                : showMedal && rank === 3
                ? "text-orange-400"
                : "text-gray-500";
            return (
              <tr
                key={row.model}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className={`px-4 py-3 font-mono ${medal}`}>#{rank}</td>
                <td className="px-4 py-3 font-medium text-gray-200">
                  {escapeHtml(modelDisplayName(row.model))}
                </td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">
                  {row.total_wins}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-mono ${
                      rank <= 3 && showMedal ? "text-amber-400" : "text-gray-400"
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
  );
}

export default function Leaderboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const top10 = data.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400 text-sm">
          Top 10 model rankings based on community votes in blind comparisons.
          {data.length > 10 && (
            <Link
              to="/all-models"
              className="ml-2 text-amber-400 hover:text-amber-300 underline"
            >
              View all {data.length} models
            </Link>
          )}
        </p>
      </div>

      {loading && (
        <div className="text-gray-500 text-sm py-8 text-center">
          Loading leaderboard...
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="text-gray-500 text-sm py-8 text-center">
          No votes yet. Be the first to compare models in the Arena!
        </div>
      )}

      {!loading && !error && top10.length > 0 && (
        <>
          <LeaderboardTable rows={top10} startRank={1} showMedal />

          {data.length > 10 && (
            <div className="text-center">
              <Link
                to="/all-models"
                className="inline-block px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white text-sm font-medium transition-colors"
              >
                View all {data.length} models
              </Link>
            </div>
          )}
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
