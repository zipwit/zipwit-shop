import { readdirSync, readFileSync } from "node:fs";
import { defaultAuthLocale } from "@better-auth-ui/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "#/components/home/hero";
import { categories, departments } from "#/data/catalog";
import { site } from "#/data/site";
import { sortLabels } from "#/features/search/catalog-filters";
import { georgianAuthLocale } from "#/i18n/auth-ka";
import { DEFAULT_LOCALE, LocaleProvider } from "#/i18n/locale";
import { en, ka } from "#/i18n/messages";
import { storefrontKa } from "#/i18n/storefront-ka";
import { translate } from "#/i18n/translate";

function leaves(value: object, prefix = ""): Record<string, string> {
	return Object.fromEntries(
		Object.entries(value).flatMap(([key, child]) => {
			const path = `${prefix}${key}`;
			return typeof child === "string"
				? [[path, child]]
				: Object.entries(leaves(child, `${path}.`));
		}),
	);
}

function placeholders(message: string) {
	return [...message.matchAll(/\{\{(\w+)\}\}/g)]
		.map((match) => match[1])
		.sort();
}

describe("Georgian locale", () => {
	it("covers every auth and app message, preserving interpolation tokens", () => {
		for (const [english, georgian] of [
			[leaves(en), leaves(ka)],
			[
				leaves(defaultAuthLocale.localization),
				leaves(georgianAuthLocale.localization),
			],
		]) {
			expect(Object.keys(georgian ?? {}).sort()).toEqual(
				Object.keys(english ?? {}).sort(),
			);
			for (const [key, value] of Object.entries(english ?? {})) {
				expect(georgian?.[key], key).toBeTruthy();
				expect(placeholders(georgian?.[key] ?? ""), key).toEqual(
					placeholders(value),
				);
			}
		}
		for (const [source, value] of Object.entries(storefrontKa)) {
			expect(placeholders(value), source).toEqual(placeholders(source));
		}
	});

	it("renders the storefront in Georgian by default and supports English overrides", () => {
		const hero = (
			<Hero
				stats={{ deals: 12, warehouses: 2, checkedAt: null }}
				topDiscount={30}
			/>
		);
		expect(DEFAULT_LOCALE).toBe("ka");
		const georgian = renderToStaticMarkup(hero);
		expect(georgian).toContain("პრემიუმ ბრენდები.");
		expect(georgian).toContain("დღეს 30%-მდე ფასდაკლება");
		const english = renderToStaticMarkup(
			<LocaleProvider value="en">{hero}</LocaleProvider>,
		);
		expect(english).toContain("Premium brands.");
		expect(english).toContain("Up to 30% off today");
	});

	it("translates configured storefront copy as well as literal UI messages", () => {
		const copy = [
			site.tagline,
			site.description,
			site.pitch,
			site.heroPitch,
			...Object.values(departments).map(({ label }) => label),
			...Object.values(categories).map(({ label }) => label),
			...Object.values(sortLabels),
		];
		for (const source of copy) {
			expect(translate(source, {}, "ka"), source).toMatch(/[ა-ჰ]/);
			expect(translate(source, {}, "en"), source).toBe(source);
		}
	});

	it("covers literal storefront translation calls in the current source", () => {
		const root = new URL("../../src/", import.meta.url);
		const files = readdirSync(root, {
			recursive: true,
			encoding: "utf8",
		}).filter(
			(file) =>
				/\.tsx?$/.test(file) &&
				!file.includes(".test.") &&
				!file.startsWith("i18n/"),
		);
		for (const file of files) {
			const code = readFileSync(new URL(file, root), "utf8");
			for (const match of code.matchAll(
				/\b(?:t|translate)\(\s*("(?:[^"\\]|\\.)*")/g,
			)) {
				const source: string = JSON.parse(match[1] ?? '""');
				expect(Object.hasOwn(storefrontKa, source), `${file}: ${source}`).toBe(
					true,
				);
			}
		}
	});

	it("leaves catalog names intact and interpolates values literally", () => {
		expect(translate("Nike Air Max")).toBe("Nike Air Max");
		expect(translate("Size {{size}}", { size: "$&" })).toBe("ზომა $&");
		expect(translate("Menu", {}, "en")).toBe("Menu");
	});
});
