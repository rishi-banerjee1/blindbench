import { useState, useEffect } from "react";
import { fetchLeaderboard } from "../services/api";
import { escapeHtml } from "../utils/sanitize";
import { modelDisplayName } from "../utils/models";

const FREE_MODELS = [
  "google/gemini-2.0-flash",
  "groq/llama-3.3-70b-versatile",
];

const BYOK_MODELS = [
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4-20250514",
];

function padModels(data, modelIds) {
  const existing = new Map(data.map((r) => [r.model, r]));
  return modelIds.map((id) =>
    existing.get(id) || { model: id, total_wins: 0, win_rate_pct: 0 }
  );
}

function LeaderboardTable({ rows, startRank = 1 }) {
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
          {rows.map((row, i) => (
            <tr
              key={row.model}
              className="border-b border-gray-800/50 hover:bg-gray-800/30"
            >
              <td className="px-4 py-3 text-gray-500 font-mono">
                #{startRank + i}
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
                    i === 0 && row.total_wins > 0
                      ? "text-amber-400"
                      : "text-gray-400"
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

  const freeRows = padModels(data, FREE_MODELS).sort(
    (a, b) => b.total_wins - a.total_wins
  );
  const byokRows = padModels(data, BYOK_MODELS).sort(
    (a, b) => b.total_wins - a.total_wins
  );

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

      {!loading && !error && data.length > 0 && (
        <>
          {/* Free Models Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <h2 className="text-lg font-semibold text-gray-200">
                Free Models
              </h2>
              <span className="text-xs text-gray-500 ml-1">
                Gemini &amp; Llama — no API key required
              </span>
            </div>
            <LeaderboardTable rows={freeRows} startRank={1} />
          </div>

          {/* BYOK Models Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <h2 className="text-lg font-semibold text-gray-200">
                BYOK Models
              </h2>
              <span className="text-xs text-gray-500 ml-1">
                Bring Your Own Key — GPT-4o &amp; Claude Sonnet 4
              </span>
            </div>
            {byokRows.every((r) => r.total_wins === 0) ? (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-500 text-sm">
                  No BYOK votes yet. Add your OpenAI or Anthropic key in the
                  Arena to include these models in blind comparisons.
                </p>
              </div>
            ) : (
              <LeaderboardTable rows={byokRows} startRank={1} />
            )}
          </div>
        </>
      )}
      <p className="text-xs text-gray-600 text-center">
        Initial data seeded from Kaggle datasets (LLM EvaluationHub, Prompt
        Engineering). Live results update as users submit prompts and vote.
      </p>
    </div>
  );
}
