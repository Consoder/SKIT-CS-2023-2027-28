"""
Sprint 3, Task 1 (FastAPI skeleton, routing & config — due 05-09-2026):
stdout logging setup shared by every backend module.
"""

import logging
import sys


def configure_logging(log_level: str) -> None:
    logging.basicConfig(
        level=log_level.upper(),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
