"""
Seed script for BlindBench.
Populates the database with sample arena data from the Kaggle prompt engineering dataset.
Uses the Supabase REST API with the service role key.
"""
import csv
import json
import random
import hashlib
import urllib.request

SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
SERVICE_ROLE_KEY = "YOUR_SERVICE_ROLE_KEY"

MODELS = ["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514"]

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
            bad_resp = (row.get("bad_prompt") or "")[:2000]
            if not task or len(task) > 1000 or len(task) < 10:
                continue
            prompts.append({
                "text": task,
                "base_response": expected if expected else f"A detailed analysis of: {task[:200]}",
                "v1_response": good_prompt if good_prompt else f"Here is my response to: {task[:200]}",
            })
    return prompts


def main():
    # Load from both dataset files for variety
    print("Loading prompts from dataset...")
    dataset = load_prompts_from_responses(
        "/tmp/prompt-dataset/Response_Examples.csv", limit=10
    )
    dataset += load_prompts_from_examples(
        "/tmp/prompt-dataset/prompt_examples_dataset.csv", limit=20
    )
    random.shuffle(dataset)
    print(f"  Loaded {len(dataset)} prompts")

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
        # Model A gets base_response, Model B gets v1_response
        for model_idx, model in enumerate(MODELS):
            text = item["base_response"] if model_idx == 0 else item["v1_response"]
            if not text:
                text = f"[Sample response from {model} for: {prompt['text'][:80]}...]"

            truth_score = round(random.uniform(0.55, 0.98), 3)
            failure = random.choice(FAILURE_TYPES)

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
