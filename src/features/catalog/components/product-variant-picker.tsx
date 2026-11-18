import type {
	SelectableSku,
	SkuSelection,
} from "#/features/catalog/product-selection";
import { colorLabel } from "#/i18n/color-label";
import { useLocale } from "#/i18n/locale";
import { sizeLabel } from "#/i18n/size-label";
import { useTranslation } from "#/i18n/translate";
import { OptionGroup } from "./option-group";

export function ProductVariantPicker({
	selection,
	onColorChange,
	onSkuChange,
}: {
	selection: SkuSelection<SelectableSku>;
	onColorChange: (color: string) => void;
	onSkuChange: (skuId: string | undefined) => void;
}) {
	const { colors, color, colorSkus, selectedSku } = selection;
	const t = useTranslation();
	const locale = useLocale();
	return (
		<>
			{colors.length > 1 && (
				<OptionGroup
					legend={
						<>
							{t("Color:")}{" "}
							<span className="font-normal">{colorLabel(color, locale)}</span>
						</>
					}
					value={color}
					options={colors.map((optionColor) => ({
						value: optionColor,
						label: colorLabel(optionColor, locale),
					}))}
					onChange={(next) => next && onColorChange(next)}
				/>
			)}
			<OptionGroup
				legend={t("Size")}
				value={selectedSku?.id}
				options={colorSkus.map((sku) => ({
					value: sku.id,
					label: sizeLabel(sku.size, locale),
					soldOut: !sku.inStock,
					ariaLabel: t(
						sku.inStock ? "Size {{size}}" : "Size {{size}}, sold out",
						{ size: sizeLabel(sku.size, locale) },
					),
				}))}
				onChange={onSkuChange}
			/>
		</>
	);
}
