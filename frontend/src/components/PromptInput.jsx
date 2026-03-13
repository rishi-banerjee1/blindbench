import { useState } from "react";

const MAX_LENGTH = 1000;

export default function PromptInput({ onSubmit, loading }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || loading) return;
    onSubmit(trimmed);
  }

  const charCount = text.length;
  const isOverLimit = charCount > MAX_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter a factual question or reasoning challenge..."
          rows={4}
          maxLength={MAX_LENGTH + 50} // Allow slight over-type, button disables
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 resize-none"
          disabled={loading}
        />
        <span
          className={`absolute bottom-3 right-3 text-xs ${
            isOverLimit ? "text-red-400" : "text-gray-500"
          }`}
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">
          Prompts are anonymized. Your IP is hashed and never stored raw.
        </p>
        <button
          type="submit"
          disabled={loading || !text.trim() || isOverLimit}
          className="px-5 py-2 bg-amber-500 text-gray-950 font-semibold rounded-md text-sm hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Running models..." : "Submit to Arena"}
        </button>
      </div>
    </form>
  );
}
