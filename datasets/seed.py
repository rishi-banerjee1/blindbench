"""
Seed script for BlindBench.
Populates the database with sample arena data from multiple Kaggle datasets:
  1. Prompt Engineering dataset (Response_Examples + prompt_examples_dataset)
  2. LLM EvaluationHub (offensiveness, bias, ethics evaluation prompts)
Uses the Supabase REST API with the service role key.
"""
import csv
import json
import random
import hashlib
import urllib.request

SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
SERVICE_ROLE_KEY = "YOUR_SERVICE_ROLE_KEY"

MODELS = ["google/gemini-2.0-flash", "groq/llama-3.3-70b-versatile"]

FAILURE_TYPES = [
    "hallucination",
    "logical_fallacy",
    "overconfidence",
    "sycophancy",
    "failure_to_abstain",
    "circular_reasoning",
    "false_premise_acceptance",
    "contradiction",
    None, None, None, None, None,  # Weight toward no failure
]

# Map EvaluationHub categories to failure types more likely to occur
EVAL_FAILURE_MAP = {
    "Offensiveness": ["sycophancy", "failure_to_abstain", "overconfidence", None, None, None],
    "Unfairness and Bias": ["sycophancy", "false_premise_acceptance", "overconfidence", None, None],
    "Ethics and Morality": ["circular_reasoning", "overconfidence", "failure_to_abstain", None, None, None],
}


def hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()


def supabase_insert(table: str, rows: list) -> list:
    """Insert rows via Supabase REST API, return inserted data."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR inserting into {table}: {e.code} — {body}")
        return []


def load_prompts_from_responses(csv_path: str, limit: int = 30) -> list:
    """Load prompts from the Response_Examples CSV (has actual responses)."""
    prompts = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if len(prompts) >= limit:
                break
            original = row.get("original_prompt", "").strip()
            if not original or len(original) > 1000 or len(original) < 10:
                continue
            prompts.append({
                "text": original,
                "base_response": (row.get("Base_Response") or "")[:2000],
                "v1_response": (row.get("V1_Response") or "")[:2000],
            })
    return prompts


def load_prompts_from_examples(csv_path: str, limit: int = 30) -> list:
    """Load prompts from the prompt_examples_dataset CSV (more variety)."""
    prompts = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if len(prompts) >= limit:
                break
            task = row.get("task_description", "").strip()
            good_prompt = row.get("good_prompt", "").strip()
            expected = (row.get("expected_answer") or "")[:2000]
            if not task or len(task) > 1000 or len(task) < 10:
                continue
            prompts.append({
                "text": task,
                "base_response": expected if expected else f"A detailed analysis of: {task[:200]}",
                "v1_response": good_prompt if good_prompt else f"Here is my response to: {task[:200]}",
            })
    return prompts


def load_prompts_from_evaluationhub(csv_path: str, limit: int = 40) -> list:
    """Load evaluation prompts from the LLM EvaluationHub dataset.

    Dataset has 4 columns (no headers): question, choices, category, correct_answer_idx.
    Categories: Offensiveness, Unfairness and Bias, Ethics and Morality.
    These are judgment prompts — perfect for testing LLM reasoning on nuanced topics.
    """
    prompts = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        all_rows = list(reader)

    # Sample evenly across categories
    by_category = {}
    for row in all_rows:
        if len(row) < 4:
            continue
        question = row[0].strip()
        category = row[2].strip()
        if not question or len(question) > 1000 or len(question) < 20:
            continue
        by_category.setdefault(category, []).append(row)

    per_cat = max(1, limit // len(by_category)) if by_category else 0
    for category, rows in by_category.items():
        sampled = random.sample(rows, min(per_cat, len(rows)))
        for row in sampled:
            question = row[0].strip()
            choices = row[1].strip()
            correct_idx = int(row[3]) if row[3].strip().isdigit() else 0

            # Build two simulated responses — one correct, one plausible but wrong
            correct_answer = f"Based on careful analysis, the answer is option {correct_idx}. {question[:100]}"
            wrong_answer = f"After considering the context, I believe the answer is option {1 - correct_idx}. {question[:100]}"

            # Assign failure types based on category
            failure_pool = EVAL_FAILURE_MAP.get(category, FAILURE_TYPES)

            prompts.append({
                "text": question,
                "base_response": correct_answer,
                "v1_response": wrong_answer,
                "category": category,
                "failure_pool": failure_pool,
            })

    random.shuffle(prompts)
    return prompts[:limit]


def main():
    print("Loading prompts from datasets...")

    dataset = []

    # Dataset 1: Prompt Engineering (if available)
    try:
        dataset += load_prompts_from_responses(
            "/tmp/prompt-dataset/Response_Examples.csv", limit=10
        )
        print(f"  Loaded {len(dataset)} from Response_Examples")
    except FileNotFoundError:
        print("  Response_Examples.csv not found, skipping")

    try:
        prev = len(dataset)
        dataset += load_prompts_from_examples(
            "/tmp/prompt-dataset/prompt_examples_dataset.csv", limit=15
        )
        print(f"  Loaded {len(dataset) - prev} from prompt_examples_dataset")
    except FileNotFoundError:
        print("  prompt_examples_dataset.csv not found, skipping")

    # Dataset 2: LLM EvaluationHub
    try:
        prev = len(dataset)
        dataset += load_prompts_from_evaluationhub(
            "/tmp/llm-evaluationhub/data.csv", limit=30
        )
        print(f"  Loaded {len(dataset) - prev} from LLM EvaluationHub")
    except FileNotFoundError:
        print("  LLM EvaluationHub data.csv not found, skipping")

    random.shuffle(dataset)
    print(f"  Total: {len(dataset)} prompts")

    if not dataset:
        print("No prompts loaded. Aborting.")
        return

    fake_ips = [f"192.168.1.{i}" for i in range(1, 51)]

    # Insert prompts
    print("Inserting prompts...")
    prompt_rows = []
    for item in dataset:
        ip = random.choice(fake_ips)
        prompt_rows.append({
            "text": item["text"],
            "ip_hash": hash_ip(ip),
        })

    inserted_prompts = supabase_insert("prompts", prompt_rows)
    if not inserted_prompts:
        print("Failed to insert prompts. Aborting.")
        return
    print(f"  Inserted {len(inserted_prompts)} prompts")

    # Insert responses (2 per prompt — one per model)
    print("Inserting responses...")
    response_rows = []
    for i, prompt in enumerate(inserted_prompts):
        item = dataset[i]
        failure_pool = item.get("failure_pool", FAILURE_TYPES)

        for model_idx, model in enumerate(MODELS):
            text = item["base_response"] if model_idx == 0 else item["v1_response"]
            if not text:
                text = f"[Sample response from {model} for: {prompt['text'][:80]}...]"

            truth_score = round(random.uniform(0.55, 0.98), 3)
            failure = random.choice(failure_pool)

            # If there's a failure, lower the truth score
            if failure:
                truth_score = round(random.uniform(0.20, 0.70), 3)

            response_rows.append({
                "prompt_id": prompt["id"],
                "model": model,
                "response_text": text,
                "truth_score": truth_score,
                "failure_type": failure,
            })

    inserted_responses = supabase_insert("responses", response_rows)
    print(f"  Inserted {len(inserted_responses)} responses")

    # Insert votes (1-3 votes per prompt)
    print("Inserting votes...")
    vote_rows = []
    for prompt in inserted_prompts:
        num_votes = random.randint(1, 3)
        for _ in range(num_votes):
            ip = random.choice(fake_ips)
            winner = random.choice(MODELS)
            vote_rows.append({
                "prompt_id": prompt["id"],
                "winner_model": winner,
                "ip_hash": hash_ip(ip),
            })

    inserted_votes = supabase_insert("votes", vote_rows)
    print(f"  Inserted {len(inserted_votes)} votes")

    # Refresh materialized views
    print("Refreshing materialized views...")
    for fn_name in ["refresh_leaderboard", "refresh_failure_summary"]:
        url = f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}"
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"  {fn_name}: OK")
        except urllib.error.HTTPError as e:
            print(f"  {fn_name}: {e.code} — {e.read().decode()}")

    print("\nDone! Database seeded with sample arena data.")


if __name__ == "__main__":
    main()
