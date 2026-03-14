# Evaluators

Canonical definitions and versioned prompts for BlindBench's evaluation pipeline.

## Files

| File | Purpose |
|------|---------|
| `taxonomy.json` | All 10 reasoning failure types with definitions and severity |
| `truth-prompt.md` | Factual accuracy evaluator prompt (used by truth-analyzer) |
| `reasoning-prompt.md` | Reasoning failure classifier prompt (used by reasoning-analyzer) |
| `perturbation-prompt.md` | Prompt variant generator (used by prompt-perturber) |

## Evaluation Pipeline

```
prompt → run-models → truth-analyzer → reasoning-analyzer
                          │                     │
                          └─→ stability-tester (optional)
                          └─→ prompt-perturber (optional)
```

## Versioning

Each prompt file includes a version number (e.g., v1.0.0). When modifying evaluator logic:

1. Update the prompt file here first
2. Update the corresponding edge function to match
3. Bump the version number
4. Note: Re-analysis of old data with new prompts is not automatically triggered

## Adding New Failure Types

1. Add the type to `taxonomy.json`
2. Update the reasoning-prompt.md system prompt
3. Update `supabase/functions/reasoning-analyzer/index.ts`
4. Update the FailureExplorer page descriptions if needed
