import { type SubmitEvent, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import {
	categories,
	categorySlugs,
	departmentSlugs,
	departments,
} from "#/data/catalog";
import { useTranslation } from "#/i18n/translate";
import { catalogFeedSchema, type SavedFeed } from "../catalog-feed";

const ruleFields = [
	{
		name: "min_discount_percent",
		label: "Minimum discount (%)",
		min: 1,
		max: 100,
		initial: 30,
	},
	{
		name: "max_age_minutes",
		label: "Offer lifetime (minutes)",
		min: 1,
		max: 1440,
		initial: 60,
	},
] as const;
const selectStyle =
	"h-11 w-full rounded-lg border bg-background px-3 font-normal";
type FeedValues = Pick<SavedFeed, "config" | "enabled">;

export function FeedEditor({
	feed,
	pending,
	error,
	onSave,
	onCancel,
}: {
	feed?: SavedFeed;
	pending: boolean;
	error?: string;
	onSave: (values: FeedValues) => void;
	onCancel: () => void;
}) {
	const t = useTranslation();
	const [validation, setValidation] = useState("");
	const config = feed?.config;
	function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const text = (key: string) => String(form.get(key) ?? "").trim();
		const parsed = catalogFeedSchema.safeParse({
			warehouse: text("warehouse"),
			department: text("department"),
			category: text("category"),
			urls: text("urls")
				.split(/\r?\n/)
				.map((url) => url.trim())
				.filter(Boolean),
			product_link_selector: text("selector") || null,
			max_pages: Number(text("max_pages")),
			rules: Object.fromEntries(
				ruleFields.map(({ name }) => [name, Number(text(name))]),
			),
		});
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			setValidation(
				issue?.code === "custom"
					? t(issue.message)
					: t("Check the domain, starting URLs and limits."),
			);
			return;
		}
		setValidation("");
		onSave({ config: parsed.data, enabled: form.has("enabled") });
	}
	return (
		<form onSubmit={submit} className="min-h-0 overflow-auto">
			<fieldset
				disabled={pending}
				className="grid gap-4 sm:grid-cols-2 [&_label]:grid [&_label]:gap-1.5 [&_label]:font-medium"
			>
				<label htmlFor="feed-warehouse" className="sm:col-span-2">
					{t("Warehouse domain")}
					<Input
						id="feed-warehouse"
						name="warehouse"
						required
						maxLength={253}
						defaultValue={config?.warehouse}
						placeholder="outlet.example"
					/>
				</label>
				<label>
					{t("Department")}
					<select
						className={selectStyle}
						name="department"
						defaultValue={config?.department ?? "women"}
					>
						{departmentSlugs.map((id) => (
							<option key={id} value={id}>
								{t(departments[id].label)}
							</option>
						))}
					</select>
				</label>
				<label>
					{t("Category")}
					<select
						className={selectStyle}
						name="category"
						defaultValue={config?.category ?? "shoes"}
					>
						{categorySlugs.map((id) => (
							<option key={id} value={id}>
								{t(categories[id].label)}
							</option>
						))}
					</select>
				</label>
				<label htmlFor="feed-urls" className="sm:col-span-2">
					{t("Starting URLs (one per line)")}
					<Textarea
						className="min-h-20 max-h-48 resize-y"
						id="feed-urls"
						name="urls"
						required
						defaultValue={config?.urls.join("\n")}
						placeholder="https://outlet.example/clearance"
					/>
				</label>
				<label htmlFor="feed-selector">
					{t("Product link selector (optional)")}
					<Input
						id="feed-selector"
						name="selector"
						maxLength={1000}
						defaultValue={config?.product_link_selector ?? ""}
						placeholder="a.product-card"
					/>
				</label>
				<label htmlFor="feed-max_pages">
					{t("Page limit per run")}
					<Input
						type="number"
						id="feed-max_pages"
						name="max_pages"
						required
						min={1}
						max={1000}
						defaultValue={config?.max_pages ?? 50}
					/>
				</label>
				{ruleFields.map((field) => (
					<label key={field.name} htmlFor={field.name}>
						{t(field.label)}
						<Input
							type="number"
							id={field.name}
							name={field.name}
							required
							min={field.min}
							max={field.max}
							defaultValue={config?.rules[field.name] ?? field.initial}
						/>
					</label>
				))}
				<label className="sm:col-span-2">
					<span className="flex items-center gap-2">
						<input
							type="checkbox"
							name="enabled"
							defaultChecked={feed?.enabled ?? true}
						/>
						{t("Include in worker runs")}
					</span>
				</label>
			</fieldset>
			{(validation || error) && (
				<p role="alert" className="mt-4 text-destructive">
					{validation || error}
				</p>
			)}
			<div className="mt-5 flex justify-end gap-2 border-t pt-4">
				<Button
					type="button"
					variant="outline"
					disabled={pending}
					onClick={onCancel}
				>
					{t("Cancel")}
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? t("Saving…") : t("Save feed")}
				</Button>
			</div>
		</form>
	);
}
