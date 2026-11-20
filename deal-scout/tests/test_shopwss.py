import json
import unittest

from bs4 import BeautifulSoup
from scout_fixtures import FEED, observed

from deal_scout.crawl import Observation
from deal_scout.deals import prepare
from deal_scout.shopwss import WAREHOUSE, shopwss_product

URL = f"https://{WAREHOUSE}/products/example-shoe"


def theme_variant(sku: str, size: str, **changes) -> dict:
    return {
        "sku": sku,
        "options": ["Black", size],
        "price": 4999,
        "compare_at_price": 7999,
        "available": True,
        "requires_selling_plan": False,
        "quantity_rule": {"min": 1, "max": None, "increment": 1},
    } | changes


def retailer_page(**offer_terms):
    data = {
        "id": 12345,
        "handle": "example-shoe",
        "options": ["Color", "Size"],
        "requires_selling_plan": False,
        "variants": [
            theme_variant("single", "8"),
            theme_variant("sold-out", "9", available=False),
            theme_variant(
                "bulk", "10", quantity_rule={"min": 3, "max": None, "increment": 1}
            ),
            theme_variant("recurring", "11", requires_selling_plan=True),
        ],
    }
    html = f'<script type="application/json" id="ProductJson-fixture__main">{json.dumps(data)}</script>'
    structured = {
        "@type": "Product",
        "name": "Example shoe",
        "sku": "single",
        "url": URL,
        "offers": {
            "@type": "Offer",
            "price": 49.99,
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            **offer_terms,
        },
    }
    return BeautifulSoup(html, "html.parser"), structured


class ShopWSSTests(unittest.TestCase):
    def test_exact_variant_sizes_and_stock_share_one_product(self):
        soup, structured = retailer_page(eligibleQuantity={"minValue": 1})
        product = shopwss_product(soup, URL, [structured])
        assert product is not None
        row = Observation(URL, observed(structured).checked_at, product)
        feed = FEED.model_copy(update={"warehouse": WAREHOUSE})
        candidate = prepare(row, feed)
        assert candidate is not None
        self.assertEqual(product["productGroupID"], "12345")
        self.assertEqual(
            [
                (sku["size"], sku["price"], sku["originalPrice"])
                for sku in candidate.record["skus"]
            ],
            [("8", 4999, 7999)],
        )

    def test_disagreement_with_public_price_or_currency_is_unusable(self):
        for terms in ({"price": 39.99}, {"priceCurrency": "CAD"}):
            soup, structured = retailer_page(**terms)
            self.assertIsNone(shopwss_product(soup, URL, [structured]))
