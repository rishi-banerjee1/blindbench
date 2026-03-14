"""
BlindBench Offline Analysis Script

Analyzes exported JSON datasets from BlindBench.
Run after exporting data via the Dataset Explorer or dataset-export API.

Usage:
    python analysis/analyze_exports.py path/to/blindbench_export.json
"""
import json
import sys
from collections import Counter


def load_dataset(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def analyze(records: list) -> None:
    total = len(records)
    print(f"\n{'='*60}")
    print(f"BlindBench Dataset Analysis — {total} records")
    print(f"{'='*60}")

    # Models
    models = Counter(r["model"] for r in records)
    print(f"\n--- Models ({len(models)}) ---")
    for model, count in models.most_common():
        print(f"  {model}: {count} responses")

    # Truth scores
    scored = [r for r in records if r.get("truth_score") is not None]
    if scored:
        avg_truth = sum(r["truth_score"] for r in scored) / len(scored)
        print(f"\n--- Truth Scores ---")
        print(f"  Scored responses: {len(scored)}/{total}")
        print(f"  Average truth score: {avg_truth:.3f}")
        for model in models:
            model_scored = [r for r in scored if r["model"] == model]
            if model_scored:
                avg = sum(r["truth_score"] for r in model_scored) / len(model_scored)
                print(f"  {model}: {avg:.3f} ({len(model_scored)} scored)")

    # Failure types
    failures = [r for r in records if r.get("failure_type")]
    if failures:
        failure_counts = Counter(r["failure_type"] for r in failures)
        failure_rate = len(failures) / total * 100
        print(f"\n--- Failure Types ({failure_rate:.1f}% failure rate) ---")
        for ftype, count in failure_counts.most_common():
            pct = count / total * 100
            print(f"  {ftype}: {count} ({pct:.1f}%)")

    # Stability scores
    stable = [r for r in records if r.get("stability_score") is not None]
    if stable:
        avg_stability = sum(r["stability_score"] for r in stable) / len(stable)
        print(f"\n--- Stability ---")
        print(f"  Tested: {len(stable)}/{total}")
        print(f"  Average stability: {avg_stability:.3f}")

    # Vote outcomes
    voted = [r for r in records if r.get("vote_winner") is not None]
    if voted:
        wins = Counter(r["vote_winner"] for r in voted)
        print(f"\n--- Vote Results ---")
        for model, count in wins.most_common():
            print(f"  {model}: {count} wins")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analysis/analyze_exports.py <export.json>")
        sys.exit(1)
    data = load_dataset(sys.argv[1])
    analyze(data)
