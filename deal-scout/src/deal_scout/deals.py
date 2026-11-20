"""Translate retailer evidence into catalog records and review inputs."""

import re
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from typing import TypedDict
from uuid import NAMESPACE_URL, uuid5

from .crawl import Observation
from .settings import Feed


def objects(value: object) -> list[dict[str, object]]:
    return [
        item
        for item in (value if isinstance(value, list) else [value])
        if isinstance(item, dict)
    ]


def label(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def number(value: object) -> Decimal | None:
    try:
        result = Decimal(str(value))
    except InvalidOperation:
        return None
    return result if result.is_finite() and result.copy_abs() <= 1_000_000_000 else None


def cents(value: object) -> int | None:
    amount = number(value)
    if amount is None or amount < Decimal("0.01"):
        return None
    whole_cents = amount.quantize(Decimal("0.01"))
    return int(whole_cents * 100) if whole_cents == amount else None


def reference_price(offer: dict[str, object]) -> int | None:
    """Only explicitly crossed-out prices establish a discount."""
    prices = {
        cents(spec.get("price"))
        for spec in objects(offer.get("priceSpecification"))
        if label(spec.get("priceType")).rsplit("/", 1)[-1] == "StrikethroughPrice"
        and spec.get("priceCurrency", "USD") == "USD"
        and single_unit_offer(spec)
        and not any(key in spec for key in ("validFrom", "validThrough"))
    }
    return prices.pop() if len(prices) == 1 else None


def timestamp(value: datetime) -> str:
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


class CatalogSku(TypedDict):
    id: str
    color: str
    size: str
    price: int
    originalPrice: int
    discount: int
    inStock: bool
    sourceExpiresAt: str
    imageUrl: str | None


class CatalogSnapshot(TypedDict):
    """JSON fields consumed by the storefront's catalog import command."""

    id: str
    slug: str
    name: str
    brand: str | None
    description: str | None
    department: str
    category: str
    currency: str
    warehouse: str
    sourceUrl: str
    browseOnly: bool
    lastSeenAt: str
    updatedAt: str
    skus: list[CatalogSku]


def offer_expiry(
    offer: dict[str, object], checked: datetime, max_age_minutes: int
) -> datetime | None:
    expires = checked + timedelta(minutes=max_age_minutes)
    for field in (
        "validFrom",
        "availabilityStarts",
        "validThrough",
        "availabilityEnds",
        "priceValidUntil",
    ):
        if field not in offer:
            continue
        is_start = field in {"validFrom", "availabilityStarts"}
        raw = label(offer[field])
        try:
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
                bound = datetime.combine(
                    date.fromisoformat(raw), time.min if is_start else time.max, UTC
                )
            else:
                bound = datetime.fromisoformat(raw)
                if bound.tzinfo is None:
                    return None
        except ValueError:
            return None
        if is_start:
            if checked < bound:
                return None
        else:
            expires = min(expires, bound)
    return expires if expires > checked else None


def sale_expiry(
    offer: dict[str, object], price: int, checked: datetime, max_age_minutes: int
) -> datetime | None:
    # Some suppliers put conditions on the unit price specification carrying the
    # advertised amount. Those conditions also apply to the quote.
    terms = [
        offer,
        *(
            spec
            for spec in objects(offer.get("priceSpecification"))
            if cents(spec.get("price")) == price
        ),
    ]
    ends = []
    for term in terms:
        if not single_unit_offer(term):
            return None
        end = offer_expiry(term, checked, max_age_minutes)
        if end is None:
            return None
        ends.append(end)
    return min(ends)


def image_url(value: object) -> str | None:
    if isinstance(value, list):
        value = next(iter(value), None)
    if isinstance(value, dict):
        value = value.get("url")
    url = label(value)
    return url if url.startswith("https://") else None


def single_unit_offer(offer: dict[str, object]) -> bool:
    """Only accept prices available on an ordinary purchase of one item."""
    if any(
        key in offer
        for key in (
            "eligibleTransactionVolume",
            "validForMemberTier",
            "eligibleCustomerType",
        )
    ):
        return False
    if "eligibleQuantity" not in offer:
        return True
    quantity = offer["eligibleQuantity"]
    if not isinstance(quantity, dict) or quantity.get("unitCode", "C62") not in (
        "C62",
        "EA",
        "H87",
    ):
        return False
    if "unitText" in quantity and label(quantity["unitText"]).lower() not in (
        "each",
        "unit",
        "piece",
        "item",
    ):
        return False
    if not any(key in quantity for key in ("value", "minValue", "maxValue")):
        return False
    for key in ("value", "minValue", "maxValue"):
        if key in quantity:
            bound = number(quantity[key])
            if bound is None or bound < 0:
                return False
            if (
                (key == "value" and bound != 1)
                or (key == "minValue" and bound > 1)
                or (key == "maxValue" and bound < 1)
            ):
                return False
    return True


def sku_id(product_id: str, retailer_sku: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"{product_id}/{retailer_sku}"))


def variants_for(product: dict[str, object]) -> list[dict[str, object]]:
    return objects(product["hasVariant"]) if "hasVariant" in product else [product]


def sale_variant(
    variant: dict[str, object], product_id: str, feed: Feed, checked: datetime
) -> CatalogSku | None:
    offers = objects(variant.get("offers"))
    if len(offers) != 1:
        return None
    offer = offers[0]
    if offer.get("@type") != "Offer" or offer.get("priceCurrency") != "USD":
        return None
    if offer.get("availability") not in (
        "https://schema.org/InStock",
        "http://schema.org/InStock",
        "InStock",
    ):
        return None
    sku, size, color = (label(variant.get(field)) for field in ("sku", "size", "color"))
    price, original = cents(offer.get("price")), reference_price(offer)
    if not all((sku, size, color)) or price is None or original is None:
        return None
    savings = (original - price) * 100
    if savings < feed.rules.min_discount_percent * original:
        return None
    expires = sale_expiry(offer, price, checked, feed.rules.max_age_minutes)
    if expires is None:
        return None
    return {
        "id": sku_id(product_id, sku),
        "color": color,
        "size": size,
        "price": price,
        "originalPrice": original,
        "discount": round(savings / original),
        "inStock": True,
        "sourceExpiresAt": timestamp(expires),
        "imageUrl": image_url(variant.get("image")),
    }


def reviews_for(product: dict[str, object]) -> tuple[str, ...]:
    """Collect optional on-page excerpts for this product."""
    bodies: dict[str, None] = {}
    for item in objects(product.get("review")):
        if "itemReviewed" in item:
            target = item["itemReviewed"]
            if not isinstance(target, dict):
                continue
            ids = [
                k
                for k in ("@id", "sku", "productID", "productGroupID", "mpn")
                if k in target
            ]
            if not ids or not all(
                label(target[k]) and target[k] == product.get(k) for k in ids
            ):
                continue
        body = label(item.get("reviewBody"))[:1000]
        if body:
            bodies[body] = None
            if len(bodies) == 12:
                break
    return tuple(bodies)


@dataclass(frozen=True, slots=True)
class ReviewEvidence:
    name: str
    brand: str | None
    retailer_product_id: str
    mpn: str
    source_url: str
    excerpts: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Candidate:
    record: CatalogSnapshot
    evidence: ReviewEvidence


def retailer_key(product: dict[str, object]) -> str:
    return label(
        product.get("productGroupID") or product.get("productID") or product.get("sku")
    )


def product_id(row: Observation, feed: Feed) -> str | None:
    key = retailer_key(row.product)
    if not key or not label(row.product.get("name")) or not feed.owns(row.source_url):
        return None
    return str(uuid5(NAMESPACE_URL, f"https://{feed.warehouse}/product/{key}"))


def prepare(row: Observation, feed: Feed) -> Candidate | None:
    """Build one snapshot using stable store, product and variant identities."""
    identifier = product_id(row, feed)
    if identifier is None:
        return None
    product = row.product
    name = label(product.get("name"))
    variants = variants_for(product)
    checked = datetime.fromisoformat(row.checked_at)
    sku_counts = Counter(label(variant.get("sku")) for variant in variants)
    skus = [
        sku
        for variant in variants
        if sku_counts[label(variant.get("sku"))] == 1
        if (sku := sale_variant(variant, identifier, feed, checked))
    ]
    brand = product.get("brand")
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower())[:150].strip("-") or "product"
    record: CatalogSnapshot = {
        "id": identifier,
        "slug": f"{slug}-{identifier}",
        "name": name,
        "brand": label(brand.get("name") if isinstance(brand, dict) else brand) or None,
        "description": label(product.get("description")) or None,
        "department": feed.department,
        "category": feed.category,
        "currency": "USD",
        "warehouse": feed.warehouse,
        "sourceUrl": row.source_url,
        "browseOnly": False,
        "lastSeenAt": row.checked_at,
        "updatedAt": row.checked_at,
        "skus": sorted(skus, key=lambda sku: sku["id"]),
    }
    return Candidate(
        record,
        ReviewEvidence(
            name=name,
            brand=record["brand"],
            retailer_product_id=retailer_key(product),
            mpn=label(product.get("mpn")),
            source_url=row.source_url,
            excerpts=reviews_for(product) if skus else (),
        ),
    )
