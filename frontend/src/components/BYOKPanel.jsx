import { useState } from "react";

const PROVIDERS = [
  {
    id: "openai_key",
    label: "OpenAI",
    placeholder: "sk-...",
    url: "https://platform.openai.com/api-keys",
    model: "GPT-4o",
  },
  {
    id: "anthropic_key",
    label: "Anthropic",
    placeholder: "sk-ant-...",
    url: "https://console.anthropic.com/settings/keys",
    model: "Claude Sonnet 4",
  },
];

export default function BYOKPanel({ keys, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [showKeys, setShowKeys] = useState({});

  function handleKeyChange(providerId, value) {
    onChange({ ...keys, [providerId]: value });
  }

  function toggleShow(providerId) {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  }

  function clearAll() {
    const cleared = {};
    PROVIDERS.forEach((p) => (cleared[p.id] = ""));
    onChange(cleared);
  }

  const activeKeyCount = PROVIDERS.filter((p) => keys[p.id]?.trim()).length;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-900 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-300">
            Bring Your Own Key (BYOK)
          </span>
          {activeKeyCount > 0 && (
            <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">
              {activeKeyCount} key{activeKeyCount > 1 ? "s" : ""} added
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">Optional</span>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4 border-t border-gray-800 bg-gray-950/50">
          {/* Security trust banner */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-950/30 border border-emerald-900/40">
            <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-medium text-emerald-400">Your keys are secure</p>
              <ul className="text-gray-400 space-y-0.5">
                <li>Keys are sent over <strong className="text-gray-300">encrypted HTTPS</strong> directly to our server-side function</li>
                <li>Keys are <strong className="text-gray-300">never stored</strong> in any database — used for this request only, then discarded</li>
                <li>Keys <strong className="text-gray-300">never leave the server</strong> — they go from our edge function to the LLM provider and nowhere else</li>
                <li>Keys are <strong className="text-gray-300">never logged</strong> — not in console, not in analytics, not anywhere</li>
                <li>Code is <strong className="text-gray-300">open source</strong> — verify the edge function yourself</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Add your API keys to include premium models alongside the free defaults (Gemini + Groq).
            Keys stay in your browser and are only sent per-request.
          </p>

          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={provider.id} className="text-sm text-gray-300 font-medium">
                  {provider.label}
                  <span className="text-gray-500 font-normal ml-1.5">({provider.model})</span>
                </label>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
                >
                  Get key &rarr;
                </a>
              </div>
              <div className="relative">
                <input
                  id={provider.id}
                  type={showKeys[provider.id] ? "text" : "password"}
                  value={keys[provider.id] || ""}
                  onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                  placeholder={provider.placeholder}
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 pr-16 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow(provider.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                >
                  {showKeys[provider.id] ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}

          {activeKeyCount > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Clear all keys
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
