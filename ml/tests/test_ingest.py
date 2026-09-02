import pandas as pd

from src.ingest import Source, _is_valid_url, load_and_clean


def test_is_valid_url_accepts_normal_urls() -> None:
    assert _is_valid_url("http://example.com")
    assert _is_valid_url("example.com/path")


def test_is_valid_url_rejects_empty_and_malformed() -> None:
    assert not _is_valid_url("")
    assert not _is_valid_url(float("nan"))
    # malformed bracket sequences used to crash urlparse with ValueError
    assert not _is_valid_url("http://ex[ample.com]")


def test_load_and_clean_normalizes_labels_and_drops_invalid(tmp_path) -> None:
    raw = tmp_path / "raw.csv"
    raw.write_text("url,label\nexample.com,good\nbad-site.com,bad\n,bad\nexample.com,unknown\n")

    source = Source(
        name="test_source",
        url="unused",
        url_col="url",
        label_col="label",
        label_map={"good": "benign", "bad": "malicious"},
    )
    df = load_and_clean(source, raw)

    assert set(df["label"]) == {"benign", "malicious"}
    assert len(df) == 2
    assert (df["source"] == "test_source").all()
