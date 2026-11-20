"""Retailer price, stock and SKU eligibility."""

import unittest
from copy import deepcopy
from dataclasses import replace
from datetime import datetime

from scout_fixtures import POSITIVE, PRODUCT, candidate_for, observed

from deal_scout.crawl import product_entities
from deal_scout.pipeline import qualify


class OfferTests(unittest.TestCase):
    def test_sku_identity_and_unit_price(self):
        document = {"@graph": [PRODUCT]}
        self.assertEqual(list(product_entities(document)), [PRODUCT])
        first = candidate_for(observed(PRODUCT))
        second = candidate_for(observed(PRODUCT))
        sku = qualify(first, lambda _: POSITIVE)["skus"][0]
        self.assertEqual(
            (sku["price"], sku["originalPrice"], sku["size"]), (4999, 10000, "US 8")
        )
        self.assertEqual(sku["id"], second.record["skus"][0]["id"])

    def test_ineligible_offers_skip_analysis(self):
        for field, value in [
            ("availability", "OutOfStock"),
            ("priceCurrency", "EUR"),
            ("priceValidUntil", "2000-01-01"),
            ("validThrough", "2000-01-01T00:00:00Z"),
            ("validFrom", "2099-01-01T00:00:00Z"),
            ("validThrough", "2030-01-01T10:00:00"),
            ("eligibleQuantity", {"minValue": 3}),
            ("eligibleQuantity", {"unitCode": "KGM", "value": 1}),
            ("eligibleQuantity", {"maxValue": 0}),
            ("validForMemberTier", {"name": "Members only"}),
            ("price", "70.01"),
            ("priceSpecification", {}),
            (
                "priceSpecification",
                [
                    {"priceType": "StrikethroughPrice", "price": 100},
                    {"priceType": "StrikethroughPrice", "price": 50},
                ],
            ),
            ("price", "NaN"),
            ("price", "49.99000000000000000000000000001"),
            ("@type", "AggregateOffer"),
        ]:
            with self.subTest(field=field):
                product = deepcopy(PRODUCT)
                product["hasVariant"][0]["offers"][field] = value
                self.assertEqual(
                    qualify(candidate_for(observed(product)), self.fail)["skus"], []
                )
        product = deepcopy(PRODUCT)
        del product["hasVariant"][0]["size"]
        self.assertEqual(
            qualify(candidate_for(observed(product)), self.fail)["skus"], []
        )

    def test_duplicate_sku_does_not_hide_other_sizes(self):
        product = deepcopy(PRODUCT)
        original = product["hasVariant"][0]
        sold_out = deepcopy(original)
        sold_out["offers"]["availability"] = "OutOfStock"
        product["hasVariant"].append(sold_out)
        candidate = candidate_for(observed(product))
        self.assertEqual(qualify(candidate, self.fail)["skus"], [])
        product["hasVariant"].append({**original, "sku": "independent", "size": "US 9"})
        record = qualify(candidate_for(observed(product)), lambda _: POSITIVE)
        self.assertEqual([sku["size"] for sku in record["skus"]], ["US 9"])

    def test_sale_price_quantity_limit(self):
        product = deepcopy(PRODUCT)
        offer = product["hasVariant"][0]["offers"]
        offer["priceSpecification"] = [
            offer["priceSpecification"],
            {
                "@type": "UnitPriceSpecification",
                "price": offer["price"],
                "eligibleQuantity": {"minValue": 3},
            },
        ]
        self.assertEqual(
            qualify(candidate_for(observed(product)), self.fail)["skus"], []
        )

    def test_supplier_expiry_caps_offer_lifetime(self):
        row = replace(
            observed(deepcopy(PRODUCT)), checked_at="2026-01-01T00:00:00.000Z"
        )
        product = deepcopy(PRODUCT)
        product["hasVariant"][0]["offers"].update(
            {
                "validFrom": row.checked_at,
                "validThrough": "2026-01-01T01:05:00+01:00",
                "eligibleQuantity": {"unitCode": "C62", "minValue": 1, "maxValue": 2},
            }
        )
        sku = candidate_for(replace(row, product=product)).record["skus"][0]
        self.assertEqual(
            datetime.fromisoformat(sku["sourceExpiresAt"]),
            datetime.fromisoformat("2026-01-01T00:05:00Z"),
        )
