"""Associate published supplier pages with their discovery feeds for later rechecks."""

import hashlib
import json

from psycopg import Connection

from .settings import Feed


def feed_scope(feed: Feed) -> str:
    # Eligibility edits must apply to an existing quote. Changing the collection
    # or its taxonomy requires discovery to establish membership again.
    location = [
        feed.warehouse,
        feed.department,
        feed.category,
        sorted(feed.urls),
        feed.product_link_selector,
    ]
    return hashlib.sha256(json.dumps(location).encode()).hexdigest()


type Source = tuple[
    str, str, str, list[str]
]  # SKU, product, observation time, feed scopes


def quote_source(db: Connection, sku: str) -> tuple[str, list[str]] | None:
    return db.execute(
        "SELECT product_id, scopes FROM deal_source WHERE sku_id = %s", (sku,)
    ).fetchone()


def known_scopes(db: Connection, products: list[str]) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    for product, scopes in db.execute(
        "SELECT DISTINCT product_id, scopes FROM deal_source WHERE product_id = ANY(%s)",
        (products,),
    ):
        result.setdefault(product, set()).update(scopes)
    return result


def remember_sources(db: Connection, sources: list[Source]) -> None:
    with db.transaction(), db.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO deal_source (sku_id, product_id, observed_at, scopes) VALUES (%s, %s, %s, %s)
               ON CONFLICT (sku_id) DO UPDATE SET observed_at = excluded.observed_at, scopes = excluded.scopes
               WHERE deal_source.observed_at < excluded.observed_at""",
            sources,
        )
