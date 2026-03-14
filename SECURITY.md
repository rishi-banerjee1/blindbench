# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BlindBench, **please report it responsibly** by opening a Pull Request or Issue on this repository.

### How to Report

1. **Open a PR** with a description of the vulnerability and a proposed fix, OR
2. **Open an Issue** titled `[SECURITY] <brief description>` with details

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected component (frontend, edge function, database, etc.)
- Severity assessment (low / medium / high / critical)
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: Dependent on severity — critical issues are prioritized immediately

---

## Security Architecture

BlindBench is designed with defense in depth:

| Layer | Protection |
|-------|-----------|
| **Frontend** | DOMPurify sanitization on all rendered content, no `dangerouslySetInnerHTML` |
| **Transport** | HTTPS only, CORS restricted to allowed origins |
| **BYOK Keys** | Encrypted in transit (TLS), used for a single request, never stored or logged server-side |
| **Edge Functions** | Input validation (prompt length, format), rate limiting (5 requests/min/IP), SHA-256 IP hashing |
| **Database** | Row Level Security (RLS) on all tables, parameterized queries (no raw SQL interpolation), anon role has SELECT-only on views |
| **Privacy** | No cookies, no tracking pixels, no third-party analytics, no PII collection |

### BYOK (Bring Your Own Key) Security

- User-provided API keys are sent over HTTPS and used in a single edge function invocation
- Keys are passed directly to the upstream provider (OpenAI, Anthropic) and discarded after the response
- Keys are **never** written to the database, logs, or any persistent storage
- The frontend stores keys only in React component state (cleared on page navigation)

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `run-models` | 5 requests | Per minute per IP |
| `truth-analyzer` | 5 requests | Per minute per IP |
| `reasoning-analyzer` | 5 requests | Per minute per IP |
| `stability-tester` | 1 request | Per 5 minutes per IP |
| `prompt-perturber` | 1 request | Per 5 minutes per IP |
| `dataset-export` | No limit | Read-only endpoint |

### Client-Side Analytics

The client-side analytics modules (`frontend/src/analytics/`) operate entirely in the browser:

- **No data leaves the browser** — all analysis is computed locally on data already fetched from the API
- **OpenAI embedding calls** (for embedding-based stability) are opt-in and only made when the user provides their own OpenAI key via BYOK
- **TF-IDF fallback** runs entirely client-side with zero network requests

---

## Threat Model

For a detailed threat model covering attack surfaces, mitigations, and risk assessments, see [`security/threat_model.md`](security/threat_model.md).

---

## Scope

The following are **in scope** for security reports:

- XSS, injection, or other OWASP Top 10 vulnerabilities
- Data leakage (API keys, user data, IP addresses)
- Authentication or authorization bypasses
- Rate limiting bypasses
- RLS policy gaps

The following are **out of scope**:

- Denial of service via excessive legitimate API calls (mitigated by rate limiting)
- Vulnerabilities in upstream LLM provider APIs (OpenAI, Google, Groq, Anthropic)
- Social engineering attacks
- Issues requiring physical access to infrastructure
