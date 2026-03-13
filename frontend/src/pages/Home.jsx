import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold">
          <span className="text-amber-400">Blind</span>Bench
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Blind-test LLM reasoning quality. Gemini and Llama go head to head —
          add your own OpenAI or Anthropic key to throw GPT-4o and Claude into the ring.
          Every response gets truth-scored and failure-classified.
        </p>
        <Link
          to="/arena"
          className="inline-block mt-4 px-6 py-3 bg-amber-500 text-gray-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Enter the Arena
        </Link>
      </section>

      {/* Models */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
          <h3 className="text-amber-400 font-semibold">Free Models (Always On)</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0"></span>
              <span><strong className="text-gray-200">Gemini 2.0 Flash</strong> — Google</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0"></span>
              <span><strong className="text-gray-200">Llama 3.3 70B</strong> — via Groq</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
          <h3 className="text-amber-400 font-semibold">BYOK Models (Bring Your Key)</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0"></span>
              <span><strong className="text-gray-200">GPT-4o</strong> — OpenAI key required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0"></span>
              <span><strong className="text-gray-200">Claude Sonnet 4</strong> — Anthropic key required</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Keys are encrypted in transit, used once, then discarded. Never stored.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "1. Submit a Prompt",
            desc: "Ask a factual question or reasoning challenge. Your prompt hits Gemini + Llama (and BYOK models if you added keys) simultaneously.",
          },
          {
            title: "2. Compare Blindly",
            desc: "See side-by-side responses labeled Model A and Model B. Identity is hidden until you vote.",
          },
          {
            title: "3. Analyze & Vote",
            desc: "Each response is scored for truth and classified for reasoning failures. Vote for the better answer.",
          },
        ].map((step) => (
          <div
            key={step.title}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-2"
          >
            <h3 className="text-amber-400 font-semibold">{step.title}</h3>
            <p className="text-gray-400 text-sm">{step.desc}</p>
          </div>
        ))}
      </section>

      {/* Security callout */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">Security by Design</h2>
        <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
          <li>All LLM calls happen server-side — API keys never touch the browser</li>
          <li>BYOK keys are encrypted over HTTPS, used for one request only, then immediately discarded</li>
          <li>Keys are never stored in any database, never logged, never sent anywhere except the LLM provider</li>
          <li>IP addresses are SHA-256 hashed — raw IPs are never stored</li>
          <li>Row Level Security on all database tables</li>
          <li>Rate limiting: max 5 submissions per minute</li>
          <li>All model output is sanitized with DOMPurify before display</li>
          <li>Fully open source — verify the edge functions yourself</li>
        </ul>
      </section>
    </div>
  );
}
