"""
ET Patrika Pipeline Scheduler

Runs the pipeline automatically at a fixed interval without human intervention.
This is intentionally dependency-light (no APScheduler/Celery required).

Usage:
  python scheduler.py --interval-minutes 5 --max-articles 5
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def run_pipeline_once(pipeline_dir: Path, max_articles: int | None, dry_run: bool) -> int:
    cmd = [sys.executable, "pipeline.py"]
    if max_articles is not None:
        cmd.extend(["--limit", str(max_articles)])
    if dry_run:
        cmd.append("--dry-run")

    print(f"\n[{utc_now()}] Scheduler starting pipeline run...")
    print(f"[{utc_now()}] Command: {' '.join(cmd)}")

    result = subprocess.run(
        cmd,
        cwd=str(pipeline_dir),
        capture_output=True,
        text=True,
    )

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)

    print(f"[{utc_now()}] Pipeline exit code: {result.returncode}")
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="ET Patrika autonomous scheduler")
    parser.add_argument(
        "--interval-minutes",
        type=int,
        default=5,
        help="Minutes between pipeline runs",
    )
    parser.add_argument(
        "--max-articles",
        type=int,
        default=5,
        help="Max articles per run (use <=10 for controlled demo/debug)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run Agent 1 only for scheduler verification",
    )
    args = parser.parse_args()

    if args.interval_minutes < 1:
        raise ValueError("--interval-minutes must be >= 1")
    if args.max_articles is not None and args.max_articles < 1:
        raise ValueError("--max-articles must be >= 1")

    pipeline_dir = Path(__file__).resolve().parent

    print("=" * 64)
    print("ET Patrika Scheduler started")
    print(f"Started at: {utc_now()}")
    print(f"Pipeline dir: {pipeline_dir}")
    print(f"Interval: {args.interval_minutes} minute(s)")
    print(f"Max articles per run: {args.max_articles}")
    print(f"Dry run mode: {args.dry_run}")
    print("=" * 64)

    while True:
        start = time.time()
        try:
            run_pipeline_once(
                pipeline_dir=pipeline_dir,
                max_articles=args.max_articles,
                dry_run=args.dry_run,
            )
        except Exception as exc:
            print(f"[{utc_now()}] Scheduler run failed: {exc}")

        elapsed = time.time() - start
        sleep_seconds = max(0, args.interval_minutes * 60 - int(elapsed))
        print(f"[{utc_now()}] Next run in {sleep_seconds} second(s)")
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    main()
