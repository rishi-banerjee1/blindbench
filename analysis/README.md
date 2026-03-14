# Analysis

Offline analysis tools for BlindBench evaluation datasets.

## Quick Start

1. Export data from the Dataset Explorer page (JSON format)
2. Run the analysis script:

```bash
python analysis/analyze_exports.py blindbench_export.json
```

## Output

The script reports:
- Model distribution (how many responses per model)
- Truth score averages (overall and per-model)
- Failure type distribution with percentages
- Stability scores (if stability tests were run)
- Vote outcome summary

## Requirements

Python 3.8+ (no external dependencies).
