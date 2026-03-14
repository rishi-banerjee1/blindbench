# BlindBench

**A blind benchmark for diagnosing reasoning failures in large language models.**

<p align="center">
  <a href="https://rishi-banerjee1.github.io/blindbench/">Live Demo</a> &nbsp;&middot;&nbsp;
  <a href="#methodology">Methodology</a> &nbsp;&middot;&nbsp;
  <a href="#dataset-format">Dataset Format</a> &nbsp;&middot;&nbsp;
  <a href="#quick-start">Quick Start</a>
</p>

---

## Why This Exists

- Every AI company says their model is the best. **We remove the branding and let the outputs speak.**
- Most LLM benchmarks test narrow skills. **We test reasoning failures** — hallucinations, sycophancy, overconfidence, circular reasoning.
- Existing leaderboards rely on automated metrics. **BlindBench adds blind human voting** — you pick the better response before knowing which model wrote it.
- Beyond preference: **factual accuracy scoring, failure classification, response stability testing, and prompt sensitivity analysis.**
- BYOK-friendly: bring your own OpenAI or Anthropic key to add GPT-4o and Claude into the blind comparison. **Keys are never stored.**

---

## Methodology

BlindBench measures seven dimensions of LLM quality:

| Dimension | What It Measures | How |
|-----------|-----------------|-----|
| **Model Preference** | Which model humans prefer in blind comparison | Side-by-side voting with hidden identities |
| **Factual Accuracy** | Whether responses contain verifiable true claims | GPT-4o claim extraction + verification scoring |
| **Reasoning Failures** | What types of reasoning errors occur | 10-type failure taxonomy + multi-label secondary pattern detection |
| **Response Stability** | How consistent responses are across repeated runs | Jaccard similarity + embedding/TF-IDF cosine similarity |
| **Prompt Sensitivity** | How robust models are to rephrasing | Semantic variants with perturbation type classification |
| **Confidence Calibration** | Whether model confidence matches factual accuracy | Linguistic marker analysis vs truth scores |
| **Token Efficiency** | Response length patterns and their correlation with quality | Hybrid token estimation with length-hallucination analysis |

### Evaluation Pipeline

```
[User Prompt]
      │
      ▼
[run-models] ──────────> [Model A Response]  [Model B Response]
      │                         │                    │
      ├──> [truth-analyzer] ────┴────────────────────┘
      │         └─ Claim extraction → truth_score (0-1)
      │
      ├──> [reasoning-analyzer]
      │         └─ Failure classification → failure_type
      │
      ├──> [stability-tester] (optional)
      │         └─ 3 runs per model → stability_score (0-1)
      │
      └──> [prompt-perturber] (optional)
                └─ 2 semantic variants → sensitivity_score (0-1)
                                │
                                ▼
                    [evaluation_records view]
                                │
                    [dataset-export] ──> JSON / CSV
```

### Client-Side Analytics (Zero Backend Changes)

The following analyses run entirely in the browser on data from existing API endpoints:

| Analysis | Module | What It Computes |
|----------|--------|-----------------|
| **Embedding Stability** | `stabilityEmbedding.js` | Cosine similarity via OpenAI `text-embedding-3-small` embeddings (BYOK key required), with TF-IDF cosine fallback when no key is available |
| **Secondary Failure Patterns** | `failurePatterns.js` | Multi-label detection of overconfidence, sycophancy, circular reasoning, evasion, and verbose-low-info patterns using regex heuristics |
| **Perturbation Classification** | `perturbationAnalysis.js` | Classifies prompt variants into 5 types: instruction amplification, instruction reduction, tone shift, constraint injection, verbosity change |
| **Token Analysis** | `tokenAnalysis.js` | Hybrid token estimation `avg(chars/4, words×1.3)`, per-model stats, and length-hallucination correlation across 5 buckets |
| **Confidence Calibration** | `calibrationAnalysis.js` | Estimates model confidence via linguistic markers (hedging, certainty, disclaimers) and computes `|confidence - truth_score|` calibration error |
| **Insight Engine** | `insightEngine.js` | Auto-generates 5-6 natural-language findings from aggregated performance data (most accurate, most stable, dominant failures, overconfident models) |

---

## What We Track

### Failure Taxonomy (10 Types)

| Failure Type | What It Means |
|---|---|
| Hallucination | Fabricated facts, citations, or data |
| Sycophancy | Agreed with user when it shouldn't have |
| Overconfidence | Stated uncertain things with false certainty |
| Circular Reasoning | Conclusion presupposed in the premise |
| False Premise Acceptance | Accepted a false premise without challenge |
| Failure to Abstain | Should have said "I don't know" |
| Logical Fallacy | Formal or informal logical errors |
| Contradiction | Contradicted itself within the response |
| Straw Man | Misrepresented the question or argument |
| Anchoring Bias | Over-relied on first information given |

Full definitions with severity levels and examples: [`evaluators/taxonomy.json`](evaluators/taxonomy.json)

---

## Features

| Page | Purpose |
|------|---------|
| **Arena** | Blind model comparison with voting, stability/perturbation tests, embedding similarity, secondary failure patterns, token counts |
| **Leaderboard** | Model win rates from blind voting |
| **Failure Explorer** | Browse reasoning failures by type and model |
| **Analytics** | Auto-generated insights, failure co-occurrence, hallucination rates, confidence calibration, length-hallucination correlation, token stats |
| **Dataset Explorer** | Browse evaluation records with inline derived metrics, export standard or enriched JSON/CSV with confidence and calibration scores |

---

## Dataset Format

Export structured evaluation records via the Dataset Explorer or API:

```bash
# JSON export
curl "https://YOUR_PROJECT.supabase.co/functions/v1/dataset-export?format=json&limit=100"

# CSV export
curl "https://YOUR_PROJECT.supabase.co/functions/v1/dataset-export?format=csv"
```

### Record Schema

| Field | Type | Description |
|-------|------|-------------|
| `prompt_id` | uuid | Unique prompt identifier |
| `prompt_text` | string | Original user prompt (max 1000 chars) |
| `model` | string | Model identifier (e.g., `google/gemini-3-flash-preview`) |
| `response_text` | string | Model's response |
| `truth_score` | 0.0-1.0 | Factual accuracy score (null if no claims) |
| `failure_type` | string | Primary reasoning failure (null if none) |
| `stability_score` | 0.0-1.0 | Response consistency (null if not tested) |
| `total_votes` | integer | Total votes cast on the parent prompt |
| `votes_won` | integer | Votes this model's response won |
| `won_vote` | boolean | Whether this response's model won the majority |

### Enriched Export (additional derived fields)

The Dataset Explorer offers enriched exports that add client-computed analytics:

| Field | Type | Description |
|-------|------|-------------|
| `response_token_estimate` | integer | Estimated token count via `avg(chars/4, words×1.3)` |
| `estimated_confidence` | 0.0-1.0 | Model's confidence level from linguistic markers |
| `confidence_calibration_error` | 0.0-1.0 | `|confidence - truth_score|` — lower is better calibrated |
| `secondary_failure_patterns` | string | Comma-separated secondary failure patterns detected via heuristics |

Full schema definition: [`datasets/schema.json`](datasets/schema.json)

---

## Seed Data

BlindBench is seeded with 4 Kaggle datasets — **3,700+ prompts, 7,500+ responses, 9,000+ votes**.

| Dataset | What It Covers | Size |
|---|---|---|
| **AI Models Benchmark 2026** | 180+ models with intelligence scores, pricing, speed | 233 models |
| **LLM Benchmark Wars 2025-2026** | 24 frontier models with MMLU, HumanEval, GPQA, SWE-bench | 24 models |
| **LLM EvaluationHub** | Offensiveness, bias, and ethics evaluation | 1,700+ prompts |
| **Prompt Engineering Dataset** | Diverse prompts with base/improved response pairs | 1,400+ prompts |

---

## Architecture

```
[Browser]  ──HTTPS──>  [GitHub Pages: React + Vite + Tailwind]
                              │
                              │ Supabase anon key only
                              ▼
                        [Supabase Edge Functions]
                         ├─ run-models (multi-provider proxy)
                         ├─ truth-analyzer
                         ├─ reasoning-analyzer
                         ├─ stability-tester
                         ├─ prompt-perturber
                         └─ dataset-export
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
              [Gemini]   [Groq]    [Postgres]
              [OpenAI]*  [Anthropic]*  ├─ RLS policies
              (* = BYOK only)         ├─ Materialized views
                                      ├─ evaluation_records view
                                      └─ Rate limits
```

### Repository Structure

```
blindbench/
├── frontend/
│   └── src/
│       ├── analytics/      Client-side analysis modules (7 modules)
│       ├── components/     React UI components
│       ├── pages/          Arena, Leaderboard, Analytics, DatasetExplorer, etc.
│       ├── services/       API client functions
│       └── utils/          Model display names, helpers
├── supabase/
│   ├── database/           Schema, migrations, RLS policies
│   └── functions/          Edge Functions (Deno)
├── evaluators/             Versioned evaluator prompts + failure taxonomy
├── datasets/               Seed data, export schema, documentation
├── analysis/               Offline analysis scripts
└── security/               Threat model
```

---

## Security Model

| Layer | Protection |
|---|---|
| Frontend | DOMPurify sanitization, no raw HTML rendering |
| Transport | HTTPS only, CORS restricted |
| BYOK Keys | Encrypted in transit, used once, never stored or logged |
| Edge Functions | Input validation, rate limiting (5/min/IP), SHA-256 IP hashing |
| Database | Row Level Security on all tables, parameterized queries |
| Privacy | No cookies, no tracking, no analytics |

Full threat model: [`security/threat_model.md`](security/threat_model.md)

**Found a vulnerability?** See [`SECURITY.md`](SECURITY.md) — open a PR or issue to report it.

---

## Quick Start

**2 minutes to run locally:**

```bash
# 1. Clone
git clone https://github.com/rishi-banerjee1/blindbench.git
cd blindbench/frontend

# 2. Configure
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 3. Install & Run
npm install
npm run dev
```

### Database Setup

Run `supabase/database/deploy_all.sql` in the Supabase SQL Editor. This includes the base schema, functions, RLS policies, and research upgrade migration.

### Edge Functions

```bash
# Set secrets
supabase secrets set GEMINI_API_KEY=... GROQ_API_KEY=... OPENAI_API_KEY=... ALLOWED_ORIGIN=...

# Deploy all functions
supabase functions deploy run-models
supabase functions deploy truth-analyzer
supabase functions deploy reasoning-analyzer
supabase functions deploy stability-tester
supabase functions deploy prompt-perturber
supabase functions deploy dataset-export
```

### Deploy to GitHub Pages

```bash
cd frontend
npm run deploy
```

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend `.env` | Public anon key (safe for client) |
| `GEMINI_API_KEY` | Supabase secrets | Server-side only (free tier) |
| `GROQ_API_KEY` | Supabase secrets | Server-side only (free tier) |
| `OPENAI_API_KEY` | Supabase secrets | Required for truth/reasoning analysis + perturbation |
| `ALLOWED_ORIGIN` | Supabase secrets | CORS origin restriction |

---

## Tech Stack

- **Frontend**: React 19 + Vite 8 + TailwindCSS v4
- **Client Analytics**: 7 pure-JS modules for embedding stability, failure patterns, perturbation classification, token analysis, confidence calibration, and insight generation
- **Backend**: Supabase Edge Functions (Deno v2)
- **Database**: PostgreSQL 17 with materialized views + RLS
- **Hosting**: GitHub Pages (static) + Supabase (backend)
- **LLM Providers**: Google Gemini, Groq (Llama), OpenAI, Anthropic (BYOK)
- **Evaluator**: GPT-4o for truth scoring, failure classification, variant generation

---

## Contributing

PRs welcome. Key extension points:

- **Add a model provider**: See `supabase/functions/_shared/model-caller.ts` — add to the model registry
- **Add a failure type**: Update `evaluators/taxonomy.json` and the reasoning analyzer prompt
- **Add an evaluator**: Follow the pattern in `truth-analyzer` or `reasoning-analyzer`

---

## License

MIT
