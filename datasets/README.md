# Datasets

BlindBench evaluation dataset tools and documentation.

## Export

Export evaluation records via the dataset-export edge function:

```bash
# JSON format
curl "https://YOUR_PROJECT.supabase.co/functions/v1/dataset-export?format=json&limit=100"

# CSV format
curl "https://YOUR_PROJECT.supabase.co/functions/v1/dataset-export?format=csv&limit=100"

# With filters
curl "https://YOUR_PROJECT.supabase.co/functions/v1/dataset-export?format=json&model=google/gemini-2.0-flash&failure_type=hallucination"
```

Or use the Dataset Explorer page in the web UI.

## Schema

See `schema.json` for the full field definitions.

## Seed Data

The `seed.py` script populates the database with sample data from Kaggle datasets:

1. **Prompt Engineering Dataset** — Response_Examples + prompt_examples_dataset
2. **LLM EvaluationHub** — Offensiveness, bias, and ethics evaluation prompts

### Running the seed script

```bash
# 1. Download datasets to /tmp/
# 2. Set your Supabase URL and service role key in seed.py
# 3. Run:
python datasets/seed.py
```

## Kaggle Attribution

- [Prompt Engineering Dataset](https://www.kaggle.com/) — prompt/response pairs
- [LLM EvaluationHub](https://www.kaggle.com/) — evaluation prompts for judgment tasks
