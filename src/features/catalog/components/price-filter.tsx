import { useState } from "react";
import { Slider } from "#/components/ui/slider";
import { useTranslation } from "#/i18n/translate";
import { usePriceFormatter } from "#/lib/price";
import { FilterPopover } from "./filter-popover";

type PriceFilterProps = {
	/** Cheapest and dearest price for the current results, in minor units. */
	range: { min: number; max: number } | null;
	minPrice?: number;
	maxPrice?: number;
	onChange: (next: { minPrice?: number; maxPrice?: number }) => void;
};

type PriceFilterInnerProps = PriceFilterProps & {
	range: NonNullable<PriceFilterProps["range"]>;
};

const toRange = (value: number | readonly number[]): [number, number] =>
	typeof value === "number" ? [value, value] : [value[0] ?? 0, value[1] ?? 0];

/** Price in whole currency units; the URL and the index keep minor units. */
export function PriceFilter(props: PriceFilterProps) {
	if (!props.range) return null;

	return <PriceFilterInner {...props} range={props.range} />;
}

function PriceFilterInner({
	range,
	minPrice,
	maxPrice,
	onChange,
}: PriceFilterInnerProps) {
	const { formatPriceCompact } = usePriceFormatter();
	const t = useTranslation();
	const [draft, setDraft] = useState<{
		key: string;
		values: [number, number];
	}>();
	const draftKey = `${minPrice ?? ""}:${maxPrice ?? ""}:${range.min}:${range.max}`;
	if (draft && draft.key !== draftKey) setDraft(undefined);

	const lo = Math.floor(range.min / 100);
	const hi = Math.max(lo + 1, Math.ceil(range.max / 100));
	const clamp = (value: number) => Math.min(hi, Math.max(lo, value));

	const [from, to] =
		draft?.key === draftKey
			? draft.values
			: [
					clamp(minPrice != null ? minPrice / 100 : lo),
					clamp(maxPrice != null ? maxPrice / 100 : hi),
				];
	const active = minPrice != null || maxPrice != null;

	return (
		<FilterPopover
			label={t("Price")}
			trigger={
				active
					? t("{{min}} to {{max}}", {
							min: formatPriceCompact(from * 100),
							max: formatPriceCompact(to * 100),
						})
					: t("Price")
			}
			active={active}
			onClear={() => {
				setDraft(undefined);
				onChange({ minPrice: undefined, maxPrice: undefined });
			}}
		>
			<p className="type-num text-lg">
				{t("{{min}} to {{max}}", {
					min: formatPriceCompact(from * 100),
					max: formatPriceCompact(to * 100),
				})}
			</p>
			<Slider
				min={lo}
				max={hi}
				step={1}
				value={[from, to]}
				getAriaLabel={(index) =>
					t(index === 0 ? "Minimum price" : "Maximum price")
				}
				getAriaValueText={(_, value) => formatPriceCompact(value * 100)}
				onValueChange={(value) =>
					setDraft({ key: draftKey, values: toRange(value) })
				}
				onValueCommitted={(value) => {
					const [nextFrom, nextTo] = toRange(value);
					onChange({
						minPrice: nextFrom <= lo ? undefined : nextFrom * 100,
						maxPrice: nextTo >= hi ? undefined : nextTo * 100,
					});
				}}
			/>
		</FilterPopover>
	);
}
