"""Representative retailer evidence shared by the deal-scout tests."""

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from deal_scout.crawl import Observation
from deal_scout.deals import Candidate, prepare, timestamp
from deal_scout.reviews import (
    Verdict,
)
from deal_scout.settings import load_feeds

FEED = load_feeds(str(Path(__file__).resolve().parents[1] / "feeds.example.json"))[0]
PRODUCT: dict[str, Any] = {
    "@type": "ProductGroup",
    "productGroupID": "trainer",
    "name": "Court Trainer",
    "review": [{"reviewBody": "True to size and the stitching has held up."}],
    "hasVariant": [
        {
            "@type": "Product",
            "sku": "navy-8",
            "size": "US 8",
            "color": "Navy",
            "offers": {
                "@type": "Offer",
                "price": "49.99",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "priceSpecification": {
                    "priceType": "https://schema.org/StrikethroughPrice",
                    "price": 100,
                },
            },
        }
    ],
}
POSITIVE = Verdict(sentiment="positive")


def observed(product: dict[str, object]) -> Observation:
    return Observation(
        "https://outlet.example/p/trainer", timestamp(datetime.now(UTC)), product
    )


def candidate_for(row: Observation) -> Candidate:
    candidate = prepare(row, FEED)
    if candidate is None:
        raise AssertionError("Expected an identifiable fixture product")
    return candidate
