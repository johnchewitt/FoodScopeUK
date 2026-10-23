"""Command-line entry point: `uv run foodscope-pipeline <command>`."""

from __future__ import annotations

import argparse
import logging
import sys

from datetime import UTC, datetime
from pathlib import Path

from foodscope_pipeline import __version__
from foodscope_pipeline.publish import DATA_DIR, REPO_ROOT, ManifestError, publish

PIPELINE_DIR = REPO_ROOT / "pipeline"
RAW_HMRC = PIPELINE_DIR / "raw" / "hmrc"
REPORTS = PIPELINE_DIR / "reports"
CONFIG = PIPELINE_DIR / "foodscope_pipeline" / "config"
POINTS = DATA_DIR / "reference" / "world-country-points.json"


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="foodscope-pipeline", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("publish", help="build and validate public/data/manifest.json")
    ingest = sub.add_parser("ingest-hmrc", help="ONLINE: fetch HMRC OTS responses into pipeline/raw/hmrc/<snapshot>/")
    ingest.add_argument("--snapshot", default=None, help="snapshot id YYYY-MM-DD (default: today, UTC)")
    build = sub.add_parser("build-trade", help="OFFLINE: raw HMRC cache → public/data/snapshots/<snapshot>/trade/")
    build.add_argument("--snapshot", required=True, help="snapshot id YYYY-MM-DD (must exist in the raw cache)")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.command == "ingest-hmrc":
        from foodscope_pipeline.sources.hmrc_ots import HmrcError, ingest, load_baskets

        snapshot = args.snapshot or _today()
        try:
            cache = ingest(snapshot, RAW_HMRC, load_baskets(CONFIG / "trade_baskets.json"))
        except HmrcError as exc:
            logging.error("ingest failed: %s", exc)
            return 1
        print(f"cached {len(cache.entries)} responses in {cache.root}")
        return 0

    if args.command == "build-trade":
        from foodscope_pipeline.sources.hmrc_ots import load_baskets
        from foodscope_pipeline.trade import TradeBuildError, build_trade

        try:
            written = build_trade(args.snapshot, RAW_HMRC, DATA_DIR, REPORTS,
                                  load_baskets(CONFIG / "trade_baskets.json"), POINTS,
                                  CONFIG / "hmrc_country_crosswalk.json")
        except TradeBuildError as exc:
            logging.error("build-trade failed: %s", exc)
            return 1
        print(f"wrote {len(written)} trade files for snapshot {args.snapshot}")
        return 0

    if args.command == "publish":
        try:
            out = publish()
        except ManifestError as exc:
            logging.error("publish failed: %s", exc)
            return 1
        print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
