"""Command-line entry point: `uv run foodscope-pipeline <command>`."""

from __future__ import annotations

import argparse
import logging
import sys

from foodscope_pipeline import __version__
from foodscope_pipeline.publish import ManifestError, publish


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="foodscope-pipeline", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("publish", help="build and validate public/data/manifest.json")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(name)s: %(message)s")

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
