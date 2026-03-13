# BlindBench

Blind-test LLM reasoning quality. Compare responses from Gemini, Groq, and optionally OpenAI/Anthropic (BYOK) side by side, with automated truth scoring and reasoning failure classification.

---

## Architecture

```
[Browser]  ──HTTPS──>  [GitHub Pages: React + Vite]
                              │
                              │ Supabase anon key only
                              ▼
                        [Supabase Edge Functions]
                         ├─ run-models
                         ├─ truth-analyzer
                         └─ reasoning-analyzer
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
              [Gemini]   [Groq]    [Postgres]
              [OpenAI]*  [Anthropic]*  ├─ RLS policies
              (* = BYOK only)         ├─ Rate limits
                                      └─ Materialized views
```

**Key security property**: API keys never reach the browser. The frontend only knows the Supabase public anon key. All LLM calls happen server-side in Edge Functions.

**BYOK security**: User-provided keys are sent over encrypted HTTPS, used for one request only, then discarded. Keys are never stored in any database, never logged, and never leave the server-side function.

---

## Security Model

| Layer | Protection |
|-------|-----------|
| Frontend | DOMPurify sanitization, CSP headers, no raw HTML rendering |
| Transport | HTTPS only, CORS restricted to allowed origin |
| BYOK Keys | Sent over HTTPS, used once per request, never stored or logged |
| Edge Functions | Input validation, rate limiting (5/min/IP), IP hashing (SHA-256) |
| Database | Row Level Security on all tables, parameterized queries |
| Secrets | API keys in Supabase env vars, never in frontend code |

Full threat model: [`security/threat_model.md`](security/threat_model.md)

---

## Environment Setup

### Prerequisites

- Node.js 18+
- Supabase account with a project
- Gemini API key (free)
- Groq API key (free)

### 1. Database Setup

Run these SQL files in the Supabase SQL Editor (in order):

```
supabase/database/schema.sql
supabase/database/functions.sql
supabase/database/rls_policies.sql
```

### 2. Supabase Edge Functions

Set environment variables in Supabase Dashboard > Edge Functions > Secrets:

```
GEMINI_API_KEY=...
GROQ_API_KEY=...
ALLOWED_ORIGIN=https://yourusername.github.io
```

Deploy functions using the Supabase CLI:

```bash
supabase functions deploy run-models
supabase functions deploy truth-analyzer
supabase functions deploy reasoning-analyzer
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

---

## BYOK (Bring Your Own Key)

Users can optionally add their own API keys for premium models:

| Provider | Model | How to get a key |
|----------|-------|------------------|
| OpenAI | GPT-4o | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | Claude Sonnet 4 | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |

BYOK keys are:
- Sent over encrypted HTTPS to the server-side edge function
- Used for the current request only, then immediately discarded
- Never stored in any database or log
- Never transmitted anywhere except to the LLM provider's API

---

## Deployment

### GitHub Pages

```bash
cd frontend
npm run deploy
```

This runs `vite build` then pushes the `dist/` folder to the `gh-pages` branch.

Configure in GitHub repo settings:
- Pages source: Deploy from branch `gh-pages`, root `/`

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Frontend `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend `.env` | Public anon key (safe for client) |
| `GEMINI_API_KEY` | Supabase secrets | Server-side only (free) |
| `GROQ_API_KEY` | Supabase secrets | Server-side only (free) |
| `ALLOWED_ORIGIN` | Supabase secrets | CORS origin restriction |
| `SUPABASE_URL` | Auto-injected | Available in Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Available in Edge Functions |

---

## Repository Structure

```
blindbench/
  frontend/
    src/
      components/    Layout, PromptInput, ResponseCard, BYOKPanel
      pages/         Home, Arena, Leaderboard, FailureExplorer
      services/      Supabase client, API service layer
      utils/         Sanitization utilities
  supabase/
    functions/
      _shared/       CORS, validation, rate limiting
      run-models/    Proxy LLM calls to Gemini + Groq (+ BYOK OpenAI/Anthropic)
      truth-analyzer/    Factual accuracy scoring
      reasoning-analyzer/ Reasoning failure classification
    database/
      schema.sql     Tables, indexes, materialized views
      functions.sql  Rate limit increment, view refresh
      rls_policies.sql  Row Level Security policies
  security/
    threat_model.md  Risk analysis and mitigations
```

---

## License

MIT
