"""Discover deals, qualify exact variants, and update the storefront catalog."""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from functools import cache
from pathlib import Path

import psycopg
from psycopg import Connection

from .crawl import Observation, collect_pages
from .deals import (
    Candidate,
    CatalogSnapshot,
    ReviewEvidence,
    label,
    prepare,
    product_id,
    sku_id,
    variants_for,
)
from .reviews import ReviewAnalyzer, ReviewError, Verdict
from .settings import FEED_LIST, Feed, load_feeds
from .sources import Source, feed_scope, known_scopes, quote_source, remember_sources

type AnalyzeReviews = Callable[[ReviewEvidence], Verdict]


def withdrawal(candidate: Candidate) -> CatalogSnapshot:
    record = candidate.record.copy()
    record.update(skus=[], browseOnly=True)
    return record


def qualify(candidate: Candidate, analyze: AnalyzeReviews) -> CatalogSnapshot:
    """Analyze eligible offers, withdrawing products with negative shopper sentiment."""
    if (
        not candidate.record["skus"]
        or analyze(candidate.evidence).sentiment == "negative"
    ):
        return withdrawal(candidate)
    return candidate.record


def publish(records: list[CatalogSnapshot], shop: Path) -> None:
    """Use the shop's trusted writer, including its revision and Search logic."""
    if not records:
        return
    environment = os.getenv("NODE_ENV", "development")
    subprocess.run(
        [
            "node",
            f"--env-file-if-exists=.env.{environment}",
            "--import",
            "tsx",
            "scripts/catalog-import.ts",
        ],
        cwd=shop,
        input="".join(json.dumps(r) + "\n" for r in records),
        text=True,
        check=True,
        timeout=120,
    )


@dataclass(frozen=True, slots=True)
class QuoteRecheck:
    url: str
    sku_id: str
    unit_price_cents: int

    def matches(self, records: list[CatalogSnapshot], now: datetime) -> bool:
        """Confirm the quoted variant and unit price against fresh supplier evidence."""
        return any(
            sku["id"] == self.sku_id
            and sku["price"] == self.unit_price_cents
            and datetime.fromisoformat(sku["sourceExpiresAt"]) > now
            for record in records
            for sku in record["skus"]
        )


def resolve_product(
    samples: list[tuple[Observation, Feed]], analyze: AnalyzeReviews
) -> tuple[CatalogSnapshot | None, int]:
    # Use the freshest retailer evidence under every feed that actually found this
    # product. A later fetch with stricter rules cannot cancel another valid offer.
    newest = max(row.checked_at for row, _ in samples)
    latest = sorted(
        [row for row, _ in samples if row.checked_at == newest],
        key=lambda row: row.source_url,
    )
    scopes = sorted({feed.model_dump_json(): feed for _, feed in samples}.items())
    result = None
    fallback = None
    skus = {}

    classify = cache(analyze)

    for _, feed in scopes:
        candidate = prepare(latest[0], feed)
        if candidate is None:
            continue
        if any(
            prepare(replace(row, source_url=latest[0].source_url), feed) != candidate
            for row in latest[1:]
        ):
            print(
                f"Conflicting observations for {candidate.record['id']}",
                file=sys.stderr,
            )
            return withdrawal(candidate), 1
        fallback = withdrawal(candidate)
        try:
            qualified = qualify(candidate, classify)
        except ReviewError as error:
            print(
                f"Review check failed for {latest[0].source_url}: {error}",
                file=sys.stderr,
            )
            return None, 1
        if not qualified["skus"]:
            continue
        result = result or candidate.record.copy()
        for sku in candidate.record["skus"]:
            existing = skus.get(sku["id"])
            if existing is None or sku["sourceExpiresAt"] > existing["sourceExpiresAt"]:
                skus[sku["id"]] = sku
    if result is None:
        return fallback, 0
    result["skus"] = [skus[key] for key in sorted(skus)]
    return result, 0


def evaluate_feeds(
    batches: list[tuple[Feed, list[Observation]]],
    analyze: AnalyzeReviews,
    target: str | None = None,
    db: Connection | None = None,
) -> tuple[list[CatalogSnapshot], int, list[Source]]:
    by_product: defaultdict[str, list[tuple[Observation, Feed]]] = defaultdict(list)
    failed = 0
    for feed, rows in batches:
        unidentified = {row.source_url for row in rows}
        for row in rows:
            if (identifier := product_id(row, feed)) is not None:
                unidentified.discard(row.source_url)
                if target is None or target == identifier:
                    by_product[identifier].append((row, feed))
        for url in sorted(unidentified):
            print(f"No identifiable product on {url}", file=sys.stderr)
        failed += len(unidentified)
    records = []
    sources: list[Source] = []
    if db is not None and by_product and len(batches) > 1:
        active = {feed_scope(feed): feed for feed, _ in batches}
        for product, scopes in known_scopes(db, list(by_product)).items():
            samples = by_product[product]
            missing = scopes.intersection(active) - {
                feed_scope(feed) for _, feed in samples
            }
            samples.extend((samples[0][0], active[scope]) for scope in sorted(missing))
    for samples in by_product.values():
        record, errors = resolve_product(samples, analyze)
        if record is not None:
            records.append(record)
            scopes = sorted({feed_scope(feed) for _, feed in samples})
            sources.extend(
                (sku["id"], record["id"], record["updatedAt"], scopes)
                for sku in record["skus"]
            )
        failed += errors
    return records, failed, sources


def discover(
    runner: asyncio.Runner, feeds: list[Feed]
) -> tuple[list[tuple[Feed, list[Observation]]], int]:
    batches = []
    failures = 0
    for feed in feeds:
        rows, failed = runner.run(
            collect_pages(
                feed.urls, selector=feed.product_link_selector, max_pages=feed.max_pages
            )
        )
        if not rows and not failed:
            print(f"No product pages observed for {feed.warehouse}", file=sys.stderr)
            failed = 1
        failures += failed
        batches.append((feed, rows))
    return batches, failures


def recheck_feeds(runner: asyncio.Runner, feeds: list[Feed], url: str) -> list[Feed]:
    if all(not feed.product_link_selector for feed in feeds):
        return [feed for feed in feeds if url in feed.urls]
    # Older quotes may predate stored membership. Establish it from the configured collections.
    batches, failed = discover(runner, feeds)
    if failed:
        return []
    return [
        feed for feed, rows in batches if any(row.source_url == url for row in rows)
    ]


def quoted_product(rows: list[Observation], feed: Feed, quoted_sku: str) -> str | None:
    """Identify the supplier product even when its quoted size no longer qualifies."""
    for row in rows:
        identifier = product_id(row, feed)
        if identifier is None:
            continue
        for variant in variants_for(row.product):
            code = label(variant.get("sku"))
            if code and sku_id(identifier, code) == quoted_sku:
                return identifier
    return None


def run_warehouse(
    runner: asyncio.Runner,
    feeds: list[Feed],
    analyze: AnalyzeReviews,
    shop: Path | None,
    recheck: QuoteRecheck | None,
    db: Connection | None,
) -> int:
    target = None
    if recheck:
        saved = quote_source(db, recheck.sku_id) if db is not None else None
        if saved:
            target, scopes = saved
            members = [feed for feed in feeds if feed_scope(feed) in scopes]
        else:
            members = recheck_feeds(runner, feeds, recheck.url)
        if not members:
            print(
                "Cannot establish an active feed for the quoted supplier page",
                file=sys.stderr,
            )
            return 1
        rows, failures = runner.run(collect_pages([recheck.url], max_pages=1))
        target = target or quoted_product(rows, members[0], recheck.sku_id)
        if target is None:
            print(
                "Quoted SKU could not be identified on its supplier page",
                file=sys.stderr,
            )
            return 1
        batches = [(feed, rows) for feed in members]
    else:
        batches, failures = discover(runner, feeds)
    if failures and len(feeds) > 1:
        return 1
    records, errors, sources = evaluate_feeds(
        batches, analyze, target, None if recheck else db
    )
    if shop is None:
        for record in records:
            print(json.dumps(record))
    else:
        publish(records, shop)
        if db is not None and not recheck and not failures:
            remember_sources(db, sources)
    if recheck:
        confirmed = not (failures or errors) and recheck.matches(
            records, datetime.now(UTC)
        )
        print(
            "SKU and price confirmed" if confirmed else "SKU or price unconfirmed",
            file=sys.stderr,
        )
        return int(not confirmed)
    return int(bool(failures or errors))


def run(
    feeds: list[Feed],
    analyze: AnalyzeReviews,
    *,
    shop: Path | None = None,
    recheck: QuoteRecheck | None = None,
    db: Connection | None = None,
) -> int:
    warehouses: defaultdict[str, list[Feed]] = defaultdict(list)
    for feed in feeds:
        warehouses[feed.warehouse].append(feed)
    status = 0
    with asyncio.Runner() as runner:
        for warehouse, group in warehouses.items():
            try:
                status |= run_warehouse(runner, group, analyze, shop, recheck, db)
            except (OSError, subprocess.SubprocessError, psycopg.Error) as error:
                print(
                    f"Deal Scout failed for {warehouse}: {type(error).__name__}",
                    file=sys.stderr,
                )
                status = 1
    return status


def parse_args() -> tuple[argparse.ArgumentParser, argparse.Namespace]:
    """Run one discovery pass or verify a single quoted SKU before payment."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "config",
        nargs="?",
        help="JSON feed file or HTTPS endpoint (default: active PostgreSQL feeds)",
    )
    parser.add_argument(
        "--publish", action="store_true", help="Update Redis (default prints JSONL)"
    )
    parser.add_argument(
        "--shop", type=Path, default=Path(__file__).resolve().parents[3]
    )
    parser.add_argument("--max-gemini-calls", type=int, default=20)
    parser.add_argument("--recheck", metavar="PRODUCT_URL")
    parser.add_argument(
        "--preview-feed",
        metavar="ID",
        help="Preview one PostgreSQL feed, including a paused starter",
    )
    parser.add_argument("--sku", help="Catalog SKU UUID to recheck")
    parser.add_argument("--expected-cents", type=int)
    args = parser.parse_args()
    recheck_fields = (args.recheck, args.sku, args.expected_cents)
    if any(v is not None for v in recheck_fields) and not (
        all(recheck_fields) and args.expected_cents > 0
    ):
        parser.error(
            "--recheck, --sku and a positive --expected-cents are required together"
        )
    if args.max_gemini_calls < 0:
        parser.error("--max-gemini-calls must be nonnegative")
    if args.preview_feed and (args.config or args.publish or args.recheck):
        parser.error("--preview-feed previews a single database feed")
    return parser, args


def main() -> None:
    parser, args = parse_args()
    feeds = load_feeds(args.config) if args.config else None
    if feeds == [] and not args.recheck:
        print("No active catalog feeds.", file=sys.stderr)
        return
    with psycopg.connect(
        os.environ.get("DATABASE_URL", ""), autocommit=True, connect_timeout=5
    ) as db:
        if args.preview_feed:
            row = db.execute(
                "SELECT config FROM catalog_feed WHERE id = %s", (args.preview_feed,)
            ).fetchone()
            if row is None:
                parser.error("Unknown preview feed ID")
            feeds = [Feed.model_validate(row[0])]
        elif feeds is None:
            feeds = FEED_LIST.validate_python(
                [
                    row[0]
                    for row in db.execute(
                        "SELECT config FROM catalog_feed WHERE enabled ORDER BY id"
                    )
                ]
            )
        recheck = None
        if args.recheck:
            recheck = QuoteRecheck(args.recheck, args.sku, args.expected_cents)
            feeds = [feed for feed in feeds if feed.owns(args.recheck)]
            if not feeds:
                parser.error("No active feed owns the quoted supplier URL")
        if not feeds:
            print("No active catalog feeds.", file=sys.stderr)
            return
        model, key = os.getenv("GEMINI_MODEL"), os.getenv("GEMINI_API_KEY")
        if not model or not key:
            parser.error("Set GEMINI_MODEL and GEMINI_API_KEY")
        analyzer = ReviewAnalyzer(db, model, key, args.max_gemini_calls)
        sys.exit(
            run(
                feeds,
                analyzer.analyze,
                shop=args.shop if args.publish else None,
                recheck=recheck,
                db=db,
            )
        )
