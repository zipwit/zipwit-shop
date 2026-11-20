"""Collect structured product data from retailer product or listing pages."""

import argparse
import asyncio
import json
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from crawlee import ConcurrencySettings
from crawlee.crawlers import BeautifulSoupCrawler, BeautifulSoupCrawlingContext
from crawlee.storage_clients import MemoryStorageClient
from crawlee.storages import RequestQueue

from .shopwss import WAREHOUSE as SHOPWSS
from .shopwss import shopwss_product


@dataclass(frozen=True, slots=True)
class Observation:
    source_url: str
    checked_at: str
    product: dict[str, object]


def product_entities(node: object) -> Iterator[dict[str, object]]:
    """Find standalone products and groups with embedded variants."""
    if isinstance(node, list):
        for item in node:
            yield from product_entities(item)
    elif isinstance(node, dict):
        types = node.get("@type")
        types = types if isinstance(types, list) else [types]
        if "Product" in types or "ProductGroup" in types:
            yield node
        yield from product_entities(node.get("@graph"))


async def collect_pages(
    urls: list[str], *, selector: str | None = None, max_pages: int | None = None
) -> tuple[list[Observation], int]:
    """Crawl seeds and optionally one level of same-origin product links."""
    storage = MemoryStorageClient()
    # Crawlee caches the default queue across crawler instances in this process.
    queue = await RequestQueue.open(name=uuid4().hex, storage_client=storage)
    crawler = BeautifulSoupCrawler(
        storage_client=storage,
        request_manager=queue,
        concurrency_settings=ConcurrencySettings(max_concurrency=2),
        respect_robots_txt_file=True,
        retry_on_blocked=False,
        use_session_pool=False,
        max_request_retries=1,
        max_requests_per_crawl=max_pages,
    )
    observations: list[Observation] = []
    unusable: set[str] = set()

    @crawler.on_skipped_request
    async def skipped(url: str, reason: str) -> None:
        crawler.log.warning("Skipped %s (%s)", url, reason)
        unusable.add(url)

    @crawler.router.default_handler
    async def collect(context: BeautifulSoupCrawlingContext) -> None:
        url = context.request.loaded_url or context.request.url
        origin = urlsplit(context.request.url)
        if urlsplit(url)[:2] != origin[:2]:
            context.log.warning(
                "Ignoring cross-origin redirect from %s", context.request.url
            )
            unusable.add(context.request.url)
            return
        if selector and context.request.label != "PRODUCT":
            links = await context.extract_links(
                selector=selector, label="PRODUCT", strategy="same-origin"
            )
            if not links:
                context.log.warning(
                    "No eligible product links on %s for %r", url, selector
                )
                unusable.add(url)
            await context.add_requests(links, strategy="same-origin")
            return
        checked_at = (
            datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )
        products = []
        for script in context.soup.select('script[type="application/ld+json"]'):
            try:
                document = json.loads(script.get_text())
            except json.JSONDecodeError:
                context.log.warning("Invalid JSON-LD on %s", url)
                continue
            products.extend(product_entities(document))
        if origin.hostname == SHOPWSS:
            product = shopwss_product(context.soup, url, products)
            products = [product] if product is not None else []
        if not products:
            context.log.warning("No structured products on %s", url)
            unusable.add(url)
        observations.extend(
            Observation(url, checked_at, product) for product in products
        )

    try:
        stats = await crawler.run(urls)
        return observations, stats.requests_failed + len(unusable)
    finally:
        await queue.drop()


async def crawl(urls: list[str], output: Path) -> None:
    """Export raw observations, reporting failed fetches to the caller."""
    rows, failures = await collect_pages(urls)
    data = json.dumps([asdict(row) for row in rows], indent=2) + "\n"
    await asyncio.to_thread(output.write_text, data, encoding="utf-8")
    if failures:
        raise SystemExit(f"{failures} pages failed or yielded no usable data")


def main() -> None:
    """Run a bounded crawl from the command line."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", nargs="+", help="Product URLs to fetch")
    parser.add_argument("--output", type=Path, default=Path("products.json"))
    args = parser.parse_args()
    if args.output.suffix != ".json":
        parser.error("--output must end in .json")
    asyncio.run(crawl(args.urls, args.output))
