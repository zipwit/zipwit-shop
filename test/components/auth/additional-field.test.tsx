import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	AdditionalField,
	type AdditionalFieldProps,
} from "#/components/auth/additional-field";

vi.mock("@better-auth-ui/react", () => ({
	useAuth: () => ({ localization: { settings: { time: "Time" } } }),
}));
const base = { name: "test", onChange: () => {}, onBlur: () => {} };
function render(
	props: Pick<AdditionalFieldProps, "field" | "value"> &
		Partial<AdditionalFieldProps>,
) {
	return renderToStaticMarkup(<AdditionalField {...base} {...props} />);
}

const Custom = ({ value }: AdditionalFieldProps) => (
	<span>{String(value)}</span>
);

describe("additional field rendering", () => {
	it("preserves label, validation feedback and pending/read-only inputs", () => {
		const html = render({
			field: {
				name: "test",
				type: "string",
				label: "Nickname",
				readOnly: true,
			},
			value: "Zip",
			isInvalid: true,
			errors: ["Required"],
			isPending: true,
		});
		expect(html).toContain('for="test"');
		expect(html).toContain('value="Zip"');
		expect(html).toContain('aria-invalid="true"');
		expect(html).toContain("Required");
		expect(html).toContain('disabled=""');
		expect(html).toContain('readOnly=""');
	});
	it("keeps numeric constraints and decimal steps", () => {
		const html = render({
			field: {
				name: "test",
				type: "number",
				label: "Amount",
				min: 1,
				max: 50,
				formatOptions: { maximumFractionDigits: 2 },
			},
			value: 1.25,
		});
		expect(html).toContain('type="number"');
		expect(html).toContain('step="0.01"');
		expect(html).toContain('min="1"');
		expect(html).toContain('max="50"');
	});
	it("renders input adornments without losing the controlled value", () => {
		const html = render({
			field: {
				name: "test",
				type: "string",
				label: "Website",
				prefix: "https://",
				suffix: ".com",
			},
			value: "zipwit",
		});
		expect(html).toContain("https://");
		expect(html).toContain(".com");
		expect(html).toContain('value="zipwit"');
		expect([...html.matchAll(/<input\b/g)]).toHaveLength(1);
	});
	it("adds optional labels only for optional fields", () => {
		expect(
			render({
				field: { name: "test", type: "string", label: "Name" },
				value: "",
				optionalLabel: " optional",
			}),
		).toContain("optional");
		expect(
			render({
				field: { name: "test", type: "string", label: "Name", required: true },
				value: "",
				optionalLabel: " optional",
			}),
		).not.toContain("optional");
	});
	it("retains custom renderers and hidden values", () => {
		expect(
			render({
				field: {
					name: "test",
					label: "Hidden",
					type: "string",
					inputType: "hidden",
				},
				value: "secret",
			}),
		).toContain('type="hidden"');

		expect(
			render({
				field: {
					name: "test",
					label: "Custom",
					type: "string",
					render: Custom,
				},
				value: "custom",
			}),
		).toBe("<span>custom</span>");
	});
});
