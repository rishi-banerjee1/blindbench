import { Link } from "react-router-dom";

const STATS = [
  { value: "106+", label: "Models Ranked" },
  { value: "3,700+", label: "Prompts Tested" },
  { value: "7,500+", label: "Responses Scored" },
  { value: "10", label: "Failure Types" },
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center space-y-6 py-16">
        <p className="text-amber-400 text-sm font-medium tracking-wider uppercase">
          Open-Source LLM Evaluation Platform
        </p>
        <h1 className="text-5xl font-bold leading-tight">
          Which LLM Do You <span className="text-amber-400">Actually</span>{" "}
          Trust?
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          BlindBench tests 100+ AI models in blind comparisons — scoring every
          response for truthfulness and classifying reasoning failures like
          hallucinations, sycophancy, and overconfidence. No marketing. Just
          data.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            to="/arena"
            className="px-6 py-3 bg-amber-500 text-gray-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            Try the Arena
          </Link>
          <Link
            to="/leaderboard"
            className="px-6 py-3 border border-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            See Rankings
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center"
          >
            <div className="text-2xl font-bold text-amber-400">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* What makes this different */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-center">
          Why BlindBench Exists
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto text-sm">
          Every AI company says their model is the best. We remove the branding
          and let the outputs speak for themselves.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Blind Testing",
              desc: "Responses are labeled Model A and Model B. You vote before identities are revealed — eliminating brand bias entirely.",
              icon: "?",
            },
            {
              title: "Truth Scoring",
              desc: "Every response is scored 0-100% for factual accuracy. Not vibes — measurable truth scores that expose which models hallucinate.",
              icon: "%",
            },
            {
              title: "Failure Classification",
              desc: "We detect 10 reasoning failure types: hallucination, sycophancy, overconfidence, circular reasoning, and more.",
              icon: "!",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                {item.icon}
              </div>
              <h3 className="font-semibold text-gray-200">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-center">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Submit a Prompt",
              desc: "Ask any question — factual, reasoning, ethical. It hits multiple models simultaneously.",
            },
            {
              step: "2",
              title: "Compare Blind",
              desc: "See side-by-side responses with hidden identities. No brand bias.",
            },
            {
              step: "3",
              title: "Vote",
              desc: "Pick the better response. Your vote shapes the global leaderboard.",
            },
            {
              step: "4",
              title: "Explore Failures",
              desc: "See which models hallucinate, sycophant, or overcommit — by the numbers.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-2"
            >
              <div className="text-amber-400 font-bold text-lg">{s.step}</div>
              <h3 className="font-semibold text-gray-200 text-sm">
                {s.title}
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Models */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-center">106+ Models Tested</h2>
        <p className="text-gray-400 text-center text-sm max-w-xl mx-auto">
          From GPT-5.2 to Gemma 3n. Frontier models, open-source, Chinese AI,
          and everything in between.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
            <h3 className="text-amber-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Free Models (Always On)
            </h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div>
                <strong className="text-gray-200">Gemini 3 Flash</strong> —
                Google
              </div>
              <div>
                <strong className="text-gray-200">Llama 3.3 70B</strong> — via
                Groq
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
            <h3 className="text-amber-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              BYOK Models (Bring Your Key)
            </h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div>
                <strong className="text-gray-200">GPT-4o</strong> — OpenAI key
              </div>
              <div>
                <strong className="text-gray-200">Claude Sonnet 4</strong> —
                Anthropic key
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Keys encrypted in transit, used once, never stored. Open source —
              verify yourself.
            </p>
          </div>
        </div>
        <div className="text-center">
          <Link
            to="/all-models"
            className="text-amber-400 hover:text-amber-300 text-sm underline"
          >
            Browse all 106+ models with benchmark data
          </Link>
        </div>
      </section>

      {/* Datasets */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Built on Real Data</h2>
        <p className="text-sm text-gray-400">
          BlindBench is seeded with 4 Kaggle datasets covering diverse
          evaluation scenarios — from ethical reasoning to coding benchmarks.
        </p>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            {
              name: "AI Models Benchmark 2026",
              desc: "180+ models with intelligence scores, pricing, speed metrics",
            },
            {
              name: "LLM Benchmark Wars 2025-2026",
              desc: "24 frontier models with MMLU, HumanEval, GPQA, SWE-bench scores",
            },
            {
              name: "LLM EvaluationHub",
              desc: "1,700+ prompts testing offensiveness, bias, and ethics detection",
            },
            {
              name: "Prompt Engineering Dataset",
              desc: "Diverse prompts with base/improved response pairs",
            },
          ].map((d) => (
            <div
              key={d.name}
              className="bg-gray-800/50 rounded-lg p-3 space-y-1"
            >
              <div className="text-gray-200 font-medium text-xs">
                {d.name}
              </div>
              <div className="text-gray-500 text-xs">{d.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">Security by Design</h2>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>All LLM calls server-side — keys never touch the browser</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>BYOK keys encrypted, used once, immediately discarded</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>IP addresses SHA-256 hashed — raw IPs never stored</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>Row Level Security on all database tables</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>Rate limiting: 5 submissions/minute</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>DOMPurify sanitization on all model output</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>Fully open source — audit every edge function</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">+</span>
            <span>No cookies, no tracking, no analytics</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4 py-8">
        <h2 className="text-2xl font-bold">
          Stop trusting marketing. Start testing.
        </h2>
        <p className="text-gray-400 text-sm">
          Submit a prompt, compare blind, and see which model actually earns
          your trust.
        </p>
        <Link
          to="/arena"
          className="inline-block px-8 py-3 bg-amber-500 text-gray-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Enter the Arena
        </Link>
      </section>
    </div>
  );
}
