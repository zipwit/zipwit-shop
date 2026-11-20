import {
	FilterIcon,
	Search01Icon,
	Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Section } from "#/components/layout/container";
import { SectionHeader } from "#/components/layout/section-header";
import { useTranslation } from "#/i18n/translate";

const steps = [
	{
		label: "Select stores",
		title: "Good finds start at the source.",
		body: "We look for reputable US warehouses and discount stores, choosing sources with original products and quality in mind.",
		icon: Store01Icon,
	},
	{
		label: "Filter & compare",
		title: "How is the discount calculated?",
		body: "We compare a retailer’s current price with its crossed-out price for the same size and colour. The offer must meet the minimum discount set for that collection and be available to buy as a single item.",
		note: "Gemini looks for shopper reviews of the same product across sites. We exclude deals when the overall feedback is negative. Mixed feedback or missing reviews can still qualify.",
		icon: FilterIcon,
	},
	{
		label: "Discover your find",
		title: "Why can a deal disappear?",
		body: "A size can sell out or its price can change. Offers expire between checks, and a later check can remove a deal that no longer qualifies.",
		icon: Search01Icon,
	},
] as const;

const layers = [
	{
		label: "stores",
		shift: 183,
		tiles: [
			[0, 0],
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
	},
	{
		label: "comparison",
		shift: 105,
		tiles: [
			[0, 0],
			[1, 0],
			[0, 1],
			[2, 1],
		],
	},
	{
		label: "selection",
		shift: 27,
		tiles: [
			[1, 0],
			[1, 1],
		],
	},
] as const;

function SelectionDiagram({ active }: { active: number }) {
	return (
		<svg
			viewBox="0 0 440 350"
			className="mx-auto h-auto w-full max-w-108"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			<g transform="rotate(-18 220 185)" stroke="#957bc4" opacity=".48">
				<ellipse cx="220" cy="185" rx="209" ry="77" strokeDasharray="2 6" />
				<ellipse cx="220" cy="185" rx="203" ry="64" strokeDasharray="152 540" />
			</g>
			<path
				d="M70 100v180m91-128v177m216-230v178"
				stroke="#a495d7"
				strokeOpacity=".55"
				strokeDasharray="4 6"
			/>
			<path
				d="M28 104h24m-12-12v24m349-26h24m-12-12v24M378 290h24m-12-12v24"
				stroke="#d9eb68"
			/>
			{layers.map((layer, index) => (
				<g
					key={layer.label}
					transform={`translate(0 ${layer.shift})`}
					className="selection-layer"
					data-active={active === index}
				>
					<path
						className="selection-layer-edge"
						d="M70 75v11l91 52 216-55V72L161 127Z"
					/>
					<path
						className="selection-layer-face"
						d="M70 75 286 20l91 52-216 55Z"
					/>
					<path
						className="selection-layer-trace"
						d="m82 75 10 6 23-6m194-32 11 6 15-4m16 29-67 17-7-4-23 6"
						fill="none"
					/>
					<circle
						className="selection-layer-terminal"
						cx="254"
						cy="93"
						r="2.6"
					/>
					{layer.tiles.map(([column, row]) => (
						<path
							key={`${column}-${row}`}
							d="M0 17 66 0l29 17-66 17Z"
							transform={`translate(${89 + column * 68 + row * 34} ${60 - column * 17 + row * 19})`}
							className="selection-layer-tile"
						/>
					))}
				</g>
			))}
			<path
				d="M31 263h21l28 17h40m215-248h43l23 14h19"
				stroke="#c2afff"
				strokeOpacity=".65"
			/>
			<circle cx="31" cy="263" r="3" fill="#d9eb68" />
			<circle cx="419" cy="46" r="3" fill="#d9eb68" />
		</svg>
	);
}

export function SelectionProcess() {
	const t = useTranslation();
	const [active, setActive] = useState(0);
	const current = steps[active] ?? steps[0];

	return (
		<Section id="our-process" spacing="compact" className="scroll-mt-24">
			<SectionHeader
				eyebrow={t("Our process")}
				title={t("From the source to your shortlist.")}
				className="mb-7 sm:mb-10"
			/>
			<div className="grid items-start gap-x-12 gap-y-6 lg:grid-cols-[1.15fr_0.85fr]">
				<div className="min-w-0">
					<fieldset
						aria-label={t("Explore our process")}
						className="flex min-w-0 flex-wrap gap-2"
					>
						{steps.map((step, index) => (
							<button
								key={step.label}
								type="button"
								aria-pressed={active === index}
								aria-controls="about-step"
								onClick={() => setActive(index)}
								className="selection-step inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 px-4 py-2 text-left text-sm font-semibold transition-colors"
							>
								<HugeiconsIcon icon={step.icon} size={17} aria-hidden="true" />
								<span className="flex-1">{t(step.label)}</span>
							</button>
						))}
					</fieldset>

					<div
						id="about-step"
						aria-live="polite"
						aria-atomic="true"
						className="pt-7"
					>
						<h3 className="type-title text-xl sm:text-2xl">
							{t(current.title)}
						</h3>
						<p className="type-body mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
							{t(current.body)}
						</p>
						{"note" in current && (
							<p className="type-body mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
								{t(current.note)}
							</p>
						)}
					</div>
				</div>
				<div className="selection-illustration">
					<SelectionDiagram active={active} />
				</div>
			</div>
		</Section>
	);
}
