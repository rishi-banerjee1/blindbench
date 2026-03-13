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
          Blind-test LLM reasoning quality. Submit a prompt, compare
          responses from leading models, and vote on which reasons better.
          All evaluations include truth scoring and failure classification.
        </p>
        <Link
          to="/arena"
          className="inline-block mt-4 px-6 py-3 bg-amber-500 text-gray-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Enter the Arena
        </Link>
      </section>

      {/* How it works */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "1. Submit a Prompt",
            desc: "Ask a factual question or pose a reasoning challenge. Your prompt is sent to multiple LLMs simultaneously.",
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
          <li>API keys never touch the browser — all LLM calls happen server-side</li>
          <li>BYOK keys are sent over HTTPS, used once, then discarded — never stored or logged</li>
          <li>IP addresses are SHA-256 hashed — we never store raw IPs</li>
          <li>Row Level Security on all database tables</li>
          <li>Rate limiting: max 5 submissions per minute</li>
          <li>All model output is sanitized before display</li>
        </ul>
      </section>
    </div>
  );
}
