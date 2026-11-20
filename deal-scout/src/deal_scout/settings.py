"""Load the store feeds and qualification rules supplied by the operator."""

import os
from pathlib import Path
from typing import Literal, Self, override
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Rules(Settings):
    min_discount_percent: int = Field(ge=1, le=100)
    max_age_minutes: int = Field(ge=1, le=1440)


class Feed(Settings):
    warehouse: str = Field(pattern=r"^[a-z0-9-]+(?:\.[a-z0-9-]+)+$")
    department: Literal["men", "women", "kids"]
    category: Literal["shoes", "clothing", "accessories"]
    urls: list[str] = Field(min_length=1)
    product_link_selector: str | None = Field(default=None, min_length=1)
    max_pages: int = Field(default=50, ge=1, le=1000)
    rules: Rules

    @model_validator(mode="after")
    def check_seeds(self) -> Self:
        """Keep each feed within one warehouse and its configured crawl budget."""
        if len(self.urls) > self.max_pages or not all(
            self.owns(url) for url in self.urls
        ):
            raise ValueError(
                "Seeds must fit max_pages and use HTTPS on the warehouse host"
            )
        return self

    def owns(self, url: str) -> bool:
        parts = urlsplit(url)
        return parts.scheme == "https" and parts.netloc == self.warehouse


class NoRedirect(HTTPRedirectHandler):
    """Send credentials only to the originally requested endpoint."""

    @override
    def redirect_request(self, req, fp, code, msg, headers, newurl) -> None:
        return None


FEED_LIST = TypeAdapter(list[Feed])


def load_feeds(location: str) -> list[Feed]:
    """Read the same JSON format from a local file or HTTPS admin endpoint."""
    scheme = urlsplit(location).scheme
    if scheme:
        if scheme != "https":
            raise ValueError("Remote configuration requires HTTPS")
        headers = {}
        if token := os.getenv("ZIPWIT_CONFIG_TOKEN"):
            headers["Authorization"] = f"Bearer {token}"
        with build_opener(NoRedirect()).open(
            Request(location, headers=headers), timeout=30
        ) as response:
            data = response.read()
    else:
        data = Path(location).read_bytes()
    return FEED_LIST.validate_json(data)
