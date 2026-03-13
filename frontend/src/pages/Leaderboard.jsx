import { useState, useEffect } from "react";
import { fetchLeaderboard } from "../services/api";
import { escapeHtml } from "../utils/sanitize";
import { modelDisplayName } from "../utils/models";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400 text-sm">
          Model rankings based on community votes in blind comparisons.
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

      {data.length > 0 && (
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
              {data.map((row, i) => (
                <tr
                  key={row.model}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="px-4 py-3 text-gray-500 font-mono">
                    #{i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    {escapeHtml(modelDisplayName(row.model))}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {row.total_wins}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono ${
                        i === 0 ? "text-amber-400" : "text-gray-400"
                      }`}
                    >
                      {row.win_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-600 text-center">
        Initial data seeded from Kaggle datasets (LLM EvaluationHub, Prompt Engineering).
        Live results update as users submit prompts and vote.
      </p>
    </div>
  );
}
