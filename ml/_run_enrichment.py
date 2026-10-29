"""
Scratch driver (2026-09-25): DNS-enrich a stratified subsample so we can
evaluate whether enrichment features actually help, without the 2-4 hour
full-dataset cost her own docs describe. Not part of the official src/
pipeline - a one-off script for this retrain pass.
"""
import time
import pandas as pd
from sklearn.model_selection import train_test_split

from src.enrichment import enrich_domains

SAMPLE_SIZE = 20_000  # reduced from 80k after the first attempt got lost to a session restart

df = pd.read_csv("data/processed/urls_with_features.csv")
print(f"Loaded {len(df):,} rows")

if len(df) > SAMPLE_SIZE:
    df, _ = train_test_split(df, train_size=SAMPLE_SIZE, random_state=42, stratify=df["label"])
    print(f"Subsampled to {len(df):,} rows (stratified)")

start = time.time()
df_enriched = enrich_domains(df, batch_size=5000, concurrency=150)
elapsed = time.time() - start

print(f"\nEnrichment done in {elapsed:.1f}s ({elapsed/60:.1f} min) for {len(df):,} rows")
print(f"Speed: {len(df)/elapsed:.1f} URLs/sec")

out_path = "data/processed/urls_enriched_sample.csv"
df_enriched.to_csv(out_path, index=False)
print(f"Saved to {out_path}")
print(f"is_resolvable rate: {df_enriched['is_resolvable'].mean():.2%}")
