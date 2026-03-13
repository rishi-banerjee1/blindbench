import { sanitizeText } from "../utils/sanitize";

/**
 * Displays a model response with truth score and failure badges.
 * All model output is sanitized before rendering to prevent XSS.
 */
export default function ResponseCard({
  label,
  responseText,
  truthScore,
  failureType,
  onVote,
  disabled,
  voted,
}) {
  // All model output goes through sanitizeText — never rendered as raw HTML
  const safeText = sanitizeText(responseText);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex gap-2">
          {truthScore !== null && truthScore !== undefined && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                truthScore >= 0.8
                  ? "bg-green-900/50 text-green-400"
                  : truthScore >= 0.5
                  ? "bg-yellow-900/50 text-yellow-400"
                  : "bg-red-900/50 text-red-400"
              }`}
            >
              Truth: {(truthScore * 100).toFixed(0)}%
            </span>
          )}
          {failureType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 font-medium">
              {failureType.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words min-h-[100px]">
        {safeText || (
          <span className="text-gray-600 italic">No response received</span>
        )}
      </div>

      {onVote && (
        <button
          onClick={onVote}
          disabled={disabled || voted}
          className={`mt-auto py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            voted
              ? "bg-amber-400/20 text-amber-400 cursor-default"
              : disabled
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 cursor-pointer"
          }`}
        >
          {voted ? "Voted" : "This response is better"}
        </button>
      )}
    </div>
  );
}
