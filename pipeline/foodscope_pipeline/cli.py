"""Command-line entry point: `uv run foodscope-pipeline <command>`."""

from __future__ import annotations

import argparse
import logging
import os
import sys

from datetime import UTC, datetime
from pathlib import Path

from foodscope_pipeline import __version__
from foodscope_pipeline.publish import DATA_DIR, REPO_ROOT, ManifestError, publish

PIPELINE_DIR = REPO_ROOT / "pipeline"
RAW_HMRC = PIPELINE_DIR / "raw" / "hmrc"
RAW_ONS = PIPELINE_DIR / "raw" / "ons"
REPORTS = PIPELINE_DIR / "reports"
RAW = PIPELINE_DIR / "raw"
SCHEMAS = REPO_ROOT / "schemas"
CONFIG = PIPELINE_DIR / "foodscope_pipeline" / "config"
POINTS = DATA_DIR / "reference" / "world-country-points.json"


def _today() -> str:
    return datetime.now(UTC).date().isoformat()



def _annotate_error(title: str, exc: BaseException) -> None:
    """On GitHub Actions, repeat an error as a job annotation (readable through the API)."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::error title={title}::{str(exc)[:900]}")


class _AnnotationHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        print(f"::warning title={record.name}::{self.format(record)[:900]}")


def _annotate_warnings(logger_name: str) -> None:
    """On GitHub Actions, repeat a module's warnings (e.g. HTTP retries) as job annotations."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        handler = _AnnotationHandler(level=logging.WARNING)
        logging.getLogger(logger_name).addHandler(handler)

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="foodscope-pipeline", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("publish", help="build and validate public/data/manifest.json")
    ingest = sub.add_parser("ingest-hmrc", help="ONLINE: fetch HMRC OTS responses into pipeline/raw/hmrc/<snapshot>/")
    ingest.add_argument("--snapshot", default=None, help="snapshot id YYYY-MM-DD (default: today, UTC)")
    ons = sub.add_parser("fetch-ons", help="ONLINE: download ONS population, lookup and boundary files into pipeline/raw/ons/<snapshot>/ (incremental)")
    ons.add_argument("--snapshot", default=None, help="snapshot id YYYY-MM-DD (default: today, UTC)")
    ref = sub.add_parser("fetch-reference", help="ONLINE: fetch a set of reference files into pipeline/raw/<publisher>/<snapshot>/ (incremental): 'stage5' = fetch-ons plus Nomis, MHCLG, NISRA and the FSA (NI food register); 'context' = ONS urban/rural classification and Defra annual production; 'stage6' = Risk Explorer inputs (FAO water stress via the World Bank, DfT ports, UKFSR theme 3, Defra June survey, Scottish Data Zone lookups, EMODnet port locations, ONS ITL1 and LSOA lookup, OS Open Roads download list, OSNI 50K transport lines, Translink NIR railway network)")
    ref.add_argument("--snapshot", default=None, help="snapshot id YYYY-MM-DD (default: today, UTC)")
    ref.add_argument("--set", default="stage5", choices=("stage5", "context", "stage6", "trade"), help="which files to fetch (default: stage5)")
    build = sub.add_parser("build-trade", help="OFFLINE: raw HMRC cache → public/data/snapshots/<snapshot>/trade/")
    build.add_argument("--snapshot", required=True, help="snapshot id YYYY-MM-DD (must exist in the raw cache)")

    local = sub.add_parser("build-local", help="OFFLINE: raw boundaries, stores and population → public/data/snapshots/<snapshot>/local/")
    local.add_argument("--snapshot", required=True, help="ONS raw snapshot id YYYY-MM-DD (pipeline/raw/ons/<snapshot>/)")

    roads = sub.add_parser("fetch-open-roads", help="ONLINE: download the OS Open Roads GB GeoPackage to a temporary folder, record its schema and extract motorways, trunk roads and primary A roads into pipeline/raw/os/<snapshot>/ (after fetch-reference --set stage6)")
    roads.add_argument("--snapshot", required=True, help="snapshot YYYY-MM-DD holding os-open-roads-downloads.json")

    areas = sub.add_parser("build-areas", help="OFFLINE: raw small-area files → <out>/snapshots/<context-snapshot>/areas/<council>/ + reports/areas-qa-<context-snapshot>.json")
    areas.add_argument("--snapshot", required=True, help="raw snapshot of the stage5 set YYYY-MM-DD (pipeline/raw/<publisher>/<snapshot>/)")
    areas.add_argument("--context-snapshot", required=True, help="raw snapshot of the context set (LSOA urban/rural class); also the output snapshot")
    areas.add_argument("--out", default=None, help="output root (default: public/data)")

    grocers = sub.add_parser("build-ni-grocers", help="OFFLINE: FSA register (NI) → NI grocers not in GEOLYTIX: <out>/snapshots/<snapshot>/register/ + reports/ni-grocers-qa-<snapshot>.json")
    grocers.add_argument("--snapshot", required=True, help="raw FSA snapshot id YYYY-MM-DD (pipeline/raw/fsa/<snapshot>/)")
    grocers.add_argument("--local-snapshot", required=True, help="local family snapshot holding stores.geojson (to leave out stores already mapped)")
    grocers.add_argument("--out", default=None, help="output root (default: public/data)")

    context = sub.add_parser("build-context", help="OFFLINE: urban/rural class and car availability per council, Defra UK production → <out>/snapshots/<snapshot>/context/ + reports/context-qa-<snapshot>.json")
    context.add_argument("--snapshot", required=True, help="raw snapshot of the context set YYYY-MM-DD (pipeline/raw/{ons,defra}/<snapshot>/)")
    context.add_argument("--reference-snapshot", required=True, help="raw snapshot of the stage5 set (ONS LAD lookup, Nomis TS045)")
    context.add_argument("--local-snapshot", required=True, help="local family snapshot holding lad-indicators.json (the council list)")
    context.add_argument("--raw-snapshot", default=None, help="raw snapshot of the context set when it differs from --snapshot (the output)")
    context.add_argument("--extra-defra-snapshot", action="append", default=[], help="another pipeline/raw/defra/<snapshot>/ folder for production items (repeatable)")
    context.add_argument("--out", default=None, help="output root (default: public/data)")

    g3 = sub.add_parser("check-baskets", help="OFFLINE: gate G3 — the baskets against Defra's trade codes (S05) and HMRC's codes → reports/basket-codes-<snapshot>.json")
    g3.add_argument("--snapshot", required=True, help="trade snapshot YYYY-MM-DD (public/data/snapshots/<snapshot>/trade/)")
    g3.add_argument("--defra-snapshot", required=True, help="raw snapshot holding the Defra trade codes (pipeline/raw/defra/<snapshot>/)")

    risk = sub.add_parser("build-risk", help="OFFLINE: Stage 6 Risk Explorer data (water stress, ports, port of entry, roads, farming regions, Priority Places by council) → <out>/snapshots/<snapshot>/risk/ + reports/risk-qa-<snapshot>.json")
    risk.add_argument("--snapshot", required=True, help="raw snapshot of the stage6 set YYYY-MM-DD")
    risk.add_argument("--reference-snapshot", required=True, help="raw snapshot of the stage5 set (NISRA NIMDM 2017)")
    risk.add_argument("--local-snapshot", required=True, help="local family snapshot holding lad-indicators.json (the council list)")
    risk.add_argument("--out", default=None, help="output root (default: public/data)")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.command == "ingest-hmrc":
        from foodscope_pipeline.sources.hmrc_ots import ingest, load_baskets

        snapshot = args.snapshot or _today()
        _annotate_warnings("foodscope_pipeline.sources.hmrc_ots")
        try:
            cache = ingest(snapshot, RAW_HMRC, load_baskets(CONFIG / "trade_baskets.json"))
        except Exception as exc:  # any failure, so that the job annotation says why
            logging.error("ingest failed: %s", exc)
            _annotate_error("ingest-hmrc failed", exc)
            return 1
        print(f"cached {len(cache.entries)} responses in {cache.root}")
        return 0

    if args.command == "fetch-ons":
        from foodscope_pipeline.sources.ons_files import OnsFetchError, fetch

        snapshot = args.snapshot or _today()
        try:
            folder = fetch(snapshot, RAW_ONS)
        except OnsFetchError as exc:
            logging.error("fetch-ons failed: %s", exc)
            return 1
        print(f"cached ONS files in {folder}")
        return 0

    if args.command == "fetch-reference":
        from foodscope_pipeline.sources import defra_stats, fsa_fhrs, mhclg_iod, nisra_files, nomis_census, ons_files
        from foodscope_pipeline.sources.ons_files import OnsFetchError, fetch

        snapshot = args.snapshot or _today()
        if args.set == "context":
            publishers = [
                ("ons", (), ons_files.CONTEXT_QUERIES),
                ("defra", defra_stats.FILES, ()),
            ]
        elif args.set == "trade":
            from foodscope_pipeline.sources import trade_files

            publishers = [("defra", trade_files.DEFRA_FILES, ())]
        elif args.set == "stage6":
            from foodscope_pipeline.sources import stage6_files as s6

            publishers = [
                ("worldbank", s6.WORLDBANK_FILES, ()),
                ("dft", s6.DFT_FILES, ()),
                ("defra", s6.DEFRA_FILES, ()),
                ("scotgov", s6.SCOTGOV_FILES, ()),
                ("emodnet", s6.EMODNET_FILES, ()),
                ("ons", (), s6.ONS_QUERIES),
                # OSNI (S34): its Spatial NI service closed the connection to GitHub's runners in three
                # runs and its ArcGIS Hub download answered HTTP 400 (25 Oct 2026). Both stay in
                # stage6_files (OSNI_PROBE_FILES, OSNI_FILES) for a retry, outside this set so every
                # push does not fail on them; Northern Ireland's roads wait for a file from John.
                ("os", tuple(f for f in s6.PROBE_FILES if f.id.startswith("os.")), ()),
                ("translink", s6.TRANSLINK_FILES, ()),
            ]
        else:
            publishers = [
                ("ons", None, None),
                ("nomis", nomis_census.FILES, ()),
                ("mhclg", mhclg_iod.FILES, ()),
                ("nisra", nisra_files.FILES, ()),
                ("fsa", fsa_fhrs.FILES, ()),
            ]
        failed = []
        # Each publisher's folder is complete or unchanged; one failure does not stop the others.
        for name, files, queries in publishers:
            try:
                folder = fetch(snapshot, RAW / name, files=files, queries=queries)
                print(f"cached {name} files in {folder}")
            except (OnsFetchError, OSError) as exc:
                logging.error("fetch %s failed: %s", name, exc)
                if os.environ.get("GITHUB_ACTIONS") == "true":
                    # An annotation can be read through the API when the job log cannot.
                    print(f"::error title=fetch {name} failed::{str(exc)[:900]}")
                failed.append(name)
        return 1 if failed else 0

    if args.command == "fetch-open-roads":
        from foodscope_pipeline.sources.ons_files import OnsFetchError
        from foodscope_pipeline.sources.os_open_roads import fetch_open_roads

        try:
            folder = fetch_open_roads(args.snapshot, RAW)
        except (OnsFetchError, OSError) as exc:
            logging.error("fetch-open-roads failed: %s", exc)
            if os.environ.get("GITHUB_ACTIONS") == "true":
                print(f"::error title=fetch-open-roads failed::{str(exc)[:900]}")
            return 1
        print(f"cached the OS Open Roads extract in {folder}")
        return 0

    if args.command == "build-trade":
        from foodscope_pipeline.sources.hmrc_ots import load_baskets, load_groups
        from foodscope_pipeline.trade import TradeBuildError, build_trade

        try:
            written = build_trade(args.snapshot, RAW_HMRC, DATA_DIR, REPORTS,
                                  load_baskets(CONFIG / "trade_baskets.json"), POINTS,
                                  CONFIG / "hmrc_country_crosswalk.json",
                                  groups=load_groups(CONFIG / "trade_baskets.json"))
        except TradeBuildError as exc:
            logging.error("build-trade failed: %s", exc)
            _annotate_error("build-trade failed", exc)
            return 1
        print(f"wrote {len(written)} trade files for snapshot {args.snapshot}")
        return 0

    if args.command == "build-local":
        from foodscope_pipeline.local import build_local, default_inputs

        try:
            written = build_local(args.snapshot, default_inputs(RAW, CONFIG, args.snapshot), DATA_DIR, REPORTS, SCHEMAS)
        except Exception as exc:  # noqa: BLE001 (report any input problem and fail the step)
            logging.error("build-local failed: %s", exc)
            return 1
        print(f"wrote {len(written)} files for local snapshot {args.snapshot}")
        return 0

    if args.command == "build-areas":
        from foodscope_pipeline.areas import build_areas, default_inputs as areas_inputs

        out = Path(args.out) if args.out else DATA_DIR
        try:
            written = build_areas(args.snapshot, areas_inputs(RAW, CONFIG, args.snapshot, args.context_snapshot), out,
                                  REPORTS, SCHEMAS, out_snapshot=args.context_snapshot)
        except Exception as exc:  # noqa: BLE001 (report any input problem and fail the step)
            logging.error("build-areas failed: %s", exc)
            return 1
        print(f"wrote {len(written)} files for areas snapshot {args.context_snapshot}")
        return 0

    if args.command == "build-ni-grocers":
        from foodscope_pipeline.ni_grocers import build_ni_grocers, default_inputs as grocer_inputs

        out = Path(args.out) if args.out else DATA_DIR
        try:
            written = build_ni_grocers(args.snapshot, grocer_inputs(RAW, CONFIG, DATA_DIR, args.snapshot, args.local_snapshot),
                                       out, REPORTS, SCHEMAS)
        except Exception as exc:  # noqa: BLE001 (report any input problem and fail the step)
            logging.error("build-ni-grocers failed: %s", exc)
            return 1
        print(f"wrote {len(written)} files for register snapshot {args.snapshot}")
        return 0

    if args.command == "build-context":
        from foodscope_pipeline.context import build_context, default_inputs as context_inputs

        out = Path(args.out) if args.out else DATA_DIR
        try:
            written = build_context(args.snapshot, context_inputs(RAW, CONFIG, DATA_DIR, args.snapshot,
                                                                 args.reference_snapshot, args.local_snapshot,
                                                                 raw_snapshot=args.raw_snapshot,
                                                                 extra_defra_snapshots=tuple(args.extra_defra_snapshot)),
                                    out, REPORTS, SCHEMAS)
        except Exception as exc:  # noqa: BLE001 (report any input problem and fail the step)
            logging.error("build-context failed: %s", exc)
            return 1
        print(f"wrote {len(written)} files for context snapshot {args.snapshot}")
        return 0

    if args.command == "check-baskets":
        from foodscope_pipeline.basket_codes import BasketCodesError, check_baskets
        from foodscope_pipeline.sources.hmrc_ots import load_baskets
        from foodscope_pipeline.sources.ons_files import files_for, load_index

        defra_dir = RAW / "defra" / args.defra_snapshot
        try:
            entry = files_for(load_index(defra_dir), "defra.trade_codes")[0]
            report = check_baskets(args.snapshot, load_baskets(CONFIG / "trade_baskets.json"), defra_dir / entry["file"],
                                   DATA_DIR / "snapshots" / args.snapshot / "trade", REPORTS)
        except (BasketCodesError, OSError, KeyError) as exc:
            logging.error("check-baskets failed: %s", exc)
            return 1
        n = sum(len(b["differences"]) for b in report["baskets"])
        print(f"G3: {len(report['baskets'])} baskets, {n} definitional differences, "
              f"one SITC division each: {report['oneSitcDivisionEach']}")
        return 0

    if args.command == "build-risk":
        from foodscope_pipeline.risk import build_risk, default_inputs as risk_inputs

        out = Path(args.out) if args.out else DATA_DIR
        try:
            written = build_risk(args.snapshot, risk_inputs(RAW, CONFIG, DATA_DIR, args.snapshot,
                                                           args.reference_snapshot, args.local_snapshot),
                                 out, REPORTS, SCHEMAS)
        except Exception as exc:  # noqa: BLE001 (report any input problem and fail the step)
            logging.error("build-risk failed: %s", exc)
            return 1
        print(f"wrote {len(written)} files for risk snapshot {args.snapshot}")
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
