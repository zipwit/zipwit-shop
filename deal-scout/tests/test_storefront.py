"""Exercise the worker's real catalog writer against the disposable CI storefront."""

import os
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

from bs4 import BeautifulSoup
from scout_fixtures import FEED, PRODUCT, candidate_for, observed

from deal_scout.pipeline import run
from deal_scout.reviews import Verdict

SHOP = Path(__file__).resolve().parents[2]


@unittest.skipUnless(
    os.getenv("SCOUT_TEST_STOREFRONT"), "requires the disposable storefront"
)
class StorefrontTests(unittest.TestCase):
    def test_publish_select_and_withdraw(self):
        origin = os.environ["SCOUT_TEST_STOREFRONT"]
        self.assertEqual(urlsplit(origin).hostname, "127.0.0.1")
        self.assertEqual(
            set(os.environ["REDIS_CLUSTER_NODES"].split(",")),
            {f"redis://127.0.0.1:{port}" for port in (17379, 17380, 17381)},
        )
        product = {**PRODUCT, "productGroupID": str(uuid4()), "review": []}
        row = observed(product)
        record = candidate_for(row).record
        sku = record["skus"][0]
        path = f"/product/{record['slug']}?sku={sku['id']}"

        def page(path: str):
            request = Request(origin + path, headers={"Cookie": "zipwit-locale=en"})
            with urlopen(request, timeout=15) as response:
                return BeautifulSoup(response.read(), "html.parser")

        with patch("deal_scout.pipeline.collect_pages", return_value=([row], 0)):
            self.assertEqual(
                run([FEED], lambda _: Verdict(sentiment="unknown"), shop=SHOP), 0
            )
        try:
            card = page("/deals").find("a", href=path)
            self.assertIsNotNone(card)
            assert card is not None
            self.assertEqual(card.get_text(strip=True), record["name"])
            detail = page(path)
            heading = detail.select_one("h1")
            assert heading is not None
            self.assertEqual(heading.get_text(strip=True), record["name"])
            self.assertIn("$49.99", detail.get_text(" ", strip=True))
            self.assertIsNotNone(detail.find("time", datetime=row.checked_at))
            self.assertIsNotNone(
                detail.find(attrs={"aria-label": "Size US 8", "aria-pressed": "true"})
            )
            self.assertNotIn(FEED.warehouse, str(detail))
        finally:
            with patch(
                "deal_scout.pipeline.collect_pages",
                return_value=([observed(product)], 0),
            ):
                self.assertEqual(
                    run([FEED], lambda _: Verdict(sentiment="negative"), shop=SHOP), 0
                )
        self.assertIsNone(page("/deals").find("a", href=path))
        with self.assertRaises(HTTPError) as missing:
            page(path)
        self.assertEqual(missing.exception.code, 404)
