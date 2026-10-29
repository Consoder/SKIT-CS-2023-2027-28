"""
Scratch driver (2026-09-25): DNS-enrich the FULL dataset, chunked and
checkpointed so a session restart doesn't lose all progress (the first
80k attempt got lost this way earlier tonight). Resumable: rerunning
this script skips chunks already written to disk.
"""
import time
from pathlib import Path

import pandas as pd

from src.enrichment import enrich_domains

CHUNK_SIZE = 40_000
OUT_DIR = Path("data/processed/enrichment_chunks")
OUT_DIR.mkdir(exist_ok=True)
FINAL_OUT = Path("data/processed/urls_enriched_full.csv")

df = pd.read_csv("data/processed/urls_with_features.csv")
df = df.reset_index(drop=True)
print(f"Loaded {len(df):,} rows total")

n_chunks = (len(df) + CHUNK_SIZE - 1) // CHUNK_SIZE
print(f"Processing in {n_chunks} chunks of {CHUNK_SIZE:,}")

overall_start = time.time()
for i in range(n_chunks):
    chunk_path = OUT_DIR / f"chunk_{i:03d}.csv"
    if chunk_path.exists():
        print(f"[chunk {i+1}/{n_chunks}] already done, skipping")
        continue

    start_idx = i * CHUNK_SIZE
    end_idx = min(start_idx + CHUNK_SIZE, len(df))
    chunk = df.iloc[start_idx:end_idx].reset_index(drop=True)

    t0 = time.time()
    enriched_chunk = enrich_domains(chunk, batch_size=10_000, concurrency=150)
    elapsed = time.time() - t0

    enriched_chunk.to_csv(chunk_path, index=False)
    print(
        f"[chunk {i+1}/{n_chunks}] {len(chunk):,} rows in {elapsed:.1f}s "
        f"({len(chunk)/elapsed:.1f} URLs/sec) -> saved {chunk_path.name}"
    )

total_elapsed = time.time() - overall_start
print(f"\nAll chunks done in {total_elapsed/60:.1f} min total")

print("Merging chunks...")
all_chunks = sorted(OUT_DIR.glob("chunk_*.csv"))
merged = pd.concat([pd.read_csv(c, low_memory=False) for c in all_chunks], ignore_index=True)
merged.to_csv(FINAL_OUT, index=False)
print(f"Saved merged result: {FINAL_OUT} ({len(merged):,} rows)")
print(f"is_resolvable rate: {merged['is_resolvable'].mean():.2%}")
print(f"Malicious resolve rate: {merged[merged['label']=='malicious']['is_resolvable'].mean():.2%}")
print(f"Benign resolve rate: {merged[merged['label']=='benign']['is_resolvable'].mean():.2%}")
