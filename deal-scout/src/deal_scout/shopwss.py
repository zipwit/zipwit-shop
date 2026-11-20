"""Read exact US offers from ShopWSS's public product-page data."""

from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field, PositiveInt, ValidationError

WAREHOUSE = "www.shopwss.com"


class QuantityRule(BaseModel):
    min: PositiveInt
    max: PositiveInt | None
    increment: PositiveInt


class Variant(BaseModel):
    sku: str
    options: list[str]
    available: bool
    price: int = Field(ge=0)
    compare_at_price: int | None = Field(ge=0)
    requires_selling_plan: bool
    quantity_rule: QuantityRule


class ProductData(BaseModel):
    id: PositiveInt
    handle: str
    options: list[str]
    requires_selling_plan: bool
    variants: list[Variant] = Field(min_length=1)


def usd_price(cents: int) -> str:
    return str(Decimal(cents).scaleb(-2))


def matches_page_offer(variant: Variant, product: dict[str, object]) -> bool:
    offer = product.get("offers")
    if (
        not isinstance(offer, dict)
        or offer.get("@type") != "Offer"
        or offer.get("priceCurrency") != "USD"
    ):
        return False
    try:
        return (
            Decimal(str(offer.get("price"))) == Decimal(usd_price(variant.price))
            and (offer.get("availability") == "https://schema.org/InStock")
            == variant.available
        )
    except InvalidOperation:
        return False


def product_offer(
    variant: Variant, product: ProductData, page_offer: dict[str, object]
) -> dict[str, object]:
    quantity = variant.quantity_rule
    available = (
        variant.available
        and not variant.requires_selling_plan
        and not product.requires_selling_plan
        and quantity.min == quantity.increment == 1
    )
    reference = variant.compare_at_price
    specs = (
        [{"priceType": "StrikethroughPrice", "price": usd_price(reference)}]
        if reference is not None
        else []
    )
    amount = usd_price(variant.price)
    raw = page_offer.get("priceSpecification")
    for term in raw if isinstance(raw, list) else [raw]:
        if isinstance(term, dict):
            if str(term.get("priceType", "")).endswith("StrikethroughPrice"):
                specs.append(term)
            else:
                # Apply conditions on the advertised price to the exact size price.
                specs.append({**term, "price": amount})
    return {
        **page_offer,
        "price": amount,
        "availability": "InStock" if available else "OutOfStock",
        "priceSpecification": specs,
    }


def shopwss_product(
    soup: BeautifulSoup, url: str, products: list[dict[str, object]]
) -> dict[str, object] | None:
    path = urlsplit(url).path.rstrip("/")
    scripts = soup.select(
        'script[type="application/json"][id^="ProductJson-"][id$="__main"]'
    )
    if len(scripts) != 1:
        return None
    try:
        data = ProductData.model_validate_json(scripts[0].get_text(), strict=True)
    except ValidationError:
        return None
    if path != f"/products/{data.handle}" or set(data.options) != {"Color", "Size"}:
        return None
    for product in products:
        href = product.get("url")
        if (
            not isinstance(href, str)
            or urlsplit(href).netloc != WAREHOUSE
            or urlsplit(href).path.rstrip("/") != path
        ):
            continue
        if any(
            variant.sku == product.get("sku") and matches_page_offer(variant, product)
            for variant in data.variants
        ):
            return normalize(product, data)
    return None


def normalize(product: dict[str, object], data: ProductData) -> dict[str, object]:
    offer = product["offers"]
    assert isinstance(offer, dict)
    color, size = data.options.index("Color"), data.options.index("Size")
    return {
        **product,
        "@type": "ProductGroup",
        "productGroupID": str(data.id),
        "hasVariant": [
            {
                "sku": variant.sku,
                "size": variant.options[size],
                "color": variant.options[color],
                "image": product.get("image"),
                "offers": product_offer(variant, data, offer),
            }
            for variant in data.variants
            if len(variant.options) == len(data.options)
        ],
    }
