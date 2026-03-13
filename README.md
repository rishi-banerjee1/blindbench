# BlindBench

**Which LLM do you actually trust?** Blind-test 100+ AI models. No branding, no marketing — just truth scores and failure classification.

<p align="center">
  <a href="https://rishi-banerjee1.github.io/blindbench/">Live Demo</a> &nbsp;&middot;&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;&middot;&nbsp;
  <a href="#datasets">Datasets</a> &nbsp;&middot;&nbsp;
  <a href="#quick-start">Quick Start</a>
</p>

---

## Why This Exists

- Every AI company says their model is the best. **We remove the branding and let the outputs speak.**
- Most LLM benchmarks test narrow skills. **We test reasoning failures** — hallucinations, sycophancy, overconfidence, circular reasoning.
- Existing leaderboards rely on automated metrics. **BlindBench adds blind human voting** — you pick the better response before knowing which model wrote it.
- BYOK-friendly: bring your own OpenAI or Anthropic key to add GPT-4o and Claude into the blind comparison. **Keys are never stored.**
- **106+ models ranked** from GPT-5.2 to Gemma 3n, across frontier, open-source, and Chinese AI ecosystems.

---

## How It Works

1. **Submit a prompt** — factual question, reasoning challenge, ethical dilemma
2. **Compare blind** — side-by-side responses labeled Model A / Model B
3. **Vote** — pick the better answer before identities are revealed
4. **Explore failures** — see which models hallucinate, sycophant, or overcommit

Every response gets:
- A **truth score** (0-100%) measuring factual accuracy
- A **failure classification** from 10 detected reasoning failure types

---

## What We Track

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

---

## Datasets

BlindBench is seeded with 4 Kaggle datasets — **3,700+ prompts, 7,500+ responses, 9,000+ votes**.

| Dataset | What It Covers | Size |
|---|---|---|
| **AI Models Benchmark 2026** | 180+ models with intelligence scores, pricing, speed | 233 models |
| **LLM Benchmark Wars 2025-2026** | 24 frontier models with MMLU, HumanEval, GPQA, SWE-bench | 24 models |
| **LLM EvaluationHub** | Offensiveness, bias, and ethics evaluation | 1,700+ prompts |
| **Prompt Engineering Dataset** | Diverse prompts with base/improved response pairs | 1,400+ prompts |

Live results update as real users submit prompts and vote.

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
                         └─ reasoning-analyzer
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
              [Gemini]   [Groq]    [Postgres]
              [OpenAI]*  [Anthropic]*  ├─ RLS policies
              (* = BYOK only)         ├─ Materialized views
                                      └─ Rate limits
```

**Key property**: API keys never reach the browser. All LLM calls happen server-side.

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

Run in Supabase SQL Editor (in order):
```
supabase/database/schema.sql
supabase/database/functions.sql
supabase/database/rls_policies.sql
```

### Edge Functions

```bash
# Set secrets
supabase secrets set GEMINI_API_KEY=... GROQ_API_KEY=... ALLOWED_ORIGIN=...

# Deploy
supabase functions deploy run-models
supabase functions deploy truth-analyzer
supabase functions deploy reasoning-analyzer
```

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend `.env` | Public anon key (safe for client) |
| `GEMINI_API_KEY` | Supabase secrets | Server-side only (free tier) |
| `GROQ_API_KEY` | Supabase secrets | Server-side only (free tier) |
| `ALLOWED_ORIGIN` | Supabase secrets | CORS origin restriction |

---

## Tech Stack

- **Frontend**: React 19 + Vite + TailwindCSS v4
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL with materialized views
- **Hosting**: GitHub Pages
- **LLM Providers**: Google Gemini, Groq (Llama), OpenAI, Anthropic (BYOK)

---

## Contributing

PRs welcome. If you want to add a model provider, see `supabase/functions/run-models/index.ts` — the model registry pattern makes it straightforward.

---

## License

MIT
