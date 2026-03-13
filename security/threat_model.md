# BlindBench — Threat Model

## System Overview

Static React frontend (GitHub Pages) communicating with Supabase backend (Postgres + Edge Functions). Edge Functions proxy all LLM API calls to OpenAI and Anthropic.

---

## Threat Categories

### 1. API Key Leakage

**Risk**: High
**Impact**: Financial loss, unauthorized API usage, quota exhaustion.

**Attack vectors**:
- API keys embedded in frontend JavaScript bundles
- Keys leaked via browser network inspector
- Keys committed to version control
- Keys in client-side error messages

**Mitigations**:
- API keys stored exclusively in Supabase environment variables
- Frontend only uses the Supabase public anon key
- All LLM calls routed through Edge Functions (server-side)
- `.env` files in `.gitignore`
- No API keys in error responses from Edge Functions
- CSP headers restrict outbound connections

---

### 2. Prompt Injection

**Risk**: Medium
**Impact**: LLM producing harmful/biased output, evaluation manipulation.

**Attack vectors**:
- Crafted prompts that override system instructions
- Prompts that extract system prompt content
- Prompts that manipulate truth/reasoning analysis

**Mitigations**:
- Input validation: max 1000 chars, no binary data
- HTML stripping before storage
- System prompts are hardcoded in Edge Functions (not user-modifiable)
- Truth analyzer uses structured JSON output format (harder to inject into)
- Analysis runs as a separate LLM call (not the same context as the user prompt)

---

### 3. LLM Abuse / Cost Attacks

**Risk**: Medium
**Impact**: Excessive API costs, service degradation.

**Attack vectors**:
- Automated bulk prompt submission
- Long prompts consuming max tokens
- Repeated submissions from different IPs (distributed attack)

**Mitigations**:
- Rate limiting: 5 requests/minute per hashed IP
- Prompt length cap: 1000 characters
- Max token limits on LLM API calls (1024 tokens)
- IP hashing prevents correlation while enabling rate limits
- Rate limit table invisible to anon users (RLS denies all access)

---

### 4. Spam Prompts

**Risk**: Medium
**Impact**: Database pollution, degraded data quality, wasted API spend.

**Attack vectors**:
- Automated gibberish submissions
- SEO spam in prompts
- Offensive content

**Mitigations**:
- Input validation (binary rejection, length limits)
- Rate limiting per IP
- IP hash tracking enables pattern detection
- Future enhancement: content moderation via LLM pre-screening

---

### 5. Vote Manipulation

**Risk**: Medium
**Impact**: Skewed leaderboard, unreliable model rankings.

**Attack vectors**:
- Automated voting from scripts
- Multiple votes per prompt from same user
- VPN/proxy IP rotation to bypass rate limits

**Mitigations**:
- IP hash recorded with votes (enables duplicate detection)
- Rate limiting on vote submissions
- Materialized view aggregation reduces impact of individual vote spam
- Future enhancement: require prompt completion before voting
- Future enhancement: vote fingerprinting (browser fingerprint hash)

---

### 6. Cross-Site Scripting (XSS)

**Risk**: High
**Impact**: Session hijacking, data theft, malicious redirects.

**Attack vectors**:
- LLM responses containing malicious HTML/JavaScript
- User prompts containing script tags stored and reflected
- Model output with crafted payloads

**Mitigations**:
- All model output sanitized via DOMPurify before rendering
- `sanitizeText()` strips ALL HTML tags from model responses
- User prompts stripped of HTML before storage
- Content-Security-Policy meta tag in HTML
- No `dangerouslySetInnerHTML` usage in React components
- `escapeHtml()` used for data in non-React contexts

---

### 7. SQL Injection

**Risk**: Low (mitigated by architecture)
**Impact**: Data breach, data manipulation.

**Attack vectors**:
- Crafted input in prompt text field
- Manipulated vote parameters

**Mitigations**:
- Supabase client uses parameterized queries (not raw SQL)
- Edge Functions use Supabase client SDK (parameterized)
- RLS policies enforce access boundaries
- No raw SQL concatenation anywhere in the codebase

---

### 8. Denial of Service

**Risk**: Medium
**Impact**: Service unavailability, excessive costs.

**Attack vectors**:
- Flooding the Edge Functions with requests
- Large payload submissions
- Slowloris-style attacks on Edge Functions

**Mitigations**:
- Rate limiting at the Edge Function layer
- Supabase's built-in infrastructure protections
- Request body size limits (implicit in Edge Function runtime)
- GitHub Pages serves static content (resilient to DoS)

---

### 9. Data Privacy

**Risk**: Medium
**Impact**: User tracking, privacy violations.

**Attack vectors**:
- IP address correlation across requests
- Prompt content containing PII

**Mitigations**:
- IP addresses hashed with SHA-256 before storage (irreversible)
- Raw IPs never stored in any table
- No user accounts or authentication required
- No cookies or local storage for tracking
- Prompts are public by design (users are informed)

---

## Security Architecture Diagram

```
[User Browser]
     │
     │  Only: Supabase anon key
     │  No: API keys, service keys
     │
     ▼
[GitHub Pages — Static React App]
     │
     │  HTTPS only
     │  CSP headers
     │  DOMPurify sanitization
     │
     ▼
[Supabase Edge Functions]
     │
     │  Rate limiting
     │  Input validation
     │  IP hashing
     │
     ├──► [Gemini API]     ← GEMINI_API_KEY (env var)
     ├──► [Groq API]       ← GROQ_API_KEY (env var)
     ├──► [OpenAI API]*    ← BYOK only (per-request, never stored)
     ├──► [Anthropic API]* ← BYOK only (per-request, never stored)
     │
     ▼
[Supabase Postgres]
     │
     │  Row Level Security
     │  Parameterized queries
     │  Materialized views
```

---

## Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Sophisticated prompt injection | Medium | Inherent to LLM systems; mitigated but not eliminated |
| Distributed vote manipulation | Low | IP rotation can bypass per-IP limits |
| LLM evaluation accuracy | Medium | Truth/reasoning analysis depends on evaluator model quality |
| Supabase service outage | Low | External dependency; no self-hosted fallback |
