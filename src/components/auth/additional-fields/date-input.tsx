import { getFormFieldErrors, resolveInputType } from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import { format } from "date-fns";
import { useState } from "react";
import { CalendarIcon, ChevronDownIcon } from "#/components/icons";
import { buttonVariants } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { dateLocales, useLocale } from "#/i18n/locale";
import { cn } from "#/lib/utils";
import type { AdditionalFieldProps } from "./types";
import { toDate } from "./values";
export function DateInput({
	name,
	field,
	value,
	onBlur,
	onChange,
	isInvalid,
	errors,
	isPending,
}: AdditionalFieldProps) {
	const locale = useLocale();
	const { localization } = useAuth();
	const inputType = resolveInputType(field);
	const isDateTime = inputType === "datetime";
	const fieldErrors = getFormFieldErrors(errors ?? []);

	const date = toDate(value);
	const time = isDateTime && date ? format(date, "HH:mm:ss") : "";
	const [open, setOpen] = useState(false);

	// The parent form owns the complete date/time value.
	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={`${name}-date`}>{field.label}</FieldLabel>

			<div className="relative flex gap-2">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						type="button"
						id={`${name}-date`}
						data-empty={!date}
						aria-invalid={isInvalid}
						aria-required={field.required}
						onBlur={onBlur}
						disabled={isPending || field.readOnly}
						className={cn(
							buttonVariants({ variant: "outline" }),
							"flex-1 justify-between font-normal",
							"data-[empty=true]:text-muted-foreground",
						)}
					>
						{date ? (
							format(date, "PPP", { locale: dateLocales[locale] })
						) : (
							<span>{field.placeholder}</span>
						)}

						{isDateTime ? <ChevronDownIcon /> : <CalendarIcon />}
					</PopoverTrigger>

					<PopoverContent className="w-auto overflow-hidden p-0" align="start">
						<Calendar
							locale={dateLocales[locale]}
							mode="single"
							selected={date}
							defaultMonth={date}
							captionLayout="dropdown"
							onSelect={(value) => {
								if (!value) {
									onChange(null);
								} else {
									const nextValue = new Date(value);
									if (isDateTime && time.trim()) {
										const [hours = "0", minutes = "0", seconds = "0"] =
											time.split(":");
										nextValue.setHours(
											Number(hours),
											Number(minutes),
											Number(seconds),
											0,
										);
									} else {
										nextValue.setHours(0, 0, 0, 0);
									}
									onChange(nextValue);
								}
								if (!isDateTime) setOpen(false);
							}}
						/>
					</PopoverContent>
				</Popover>

				{isDateTime && (
					<Field className="w-32">
						<FieldLabel htmlFor={`${name}-time`} className="sr-only">
							{localization.settings.time}
						</FieldLabel>

						<Input
							type="time"
							id={`${name}-time`}
							step="1"
							value={time}
							onChange={(event) => {
								const nextTime = event.target.value;
								if (!date) return;
								const nextValue = new Date(date);
								const [hours = "0", minutes = "0", seconds = "0"] =
									nextTime.split(":");
								nextValue.setHours(
									Number(hours),
									Number(minutes),
									Number(seconds),
									0,
								);
								onChange(nextValue);
							}}
							disabled={!date || isPending || field.readOnly}
							className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
						/>
					</Field>
				)}
			</div>

			<FieldError errors={fieldErrors} />
		</Field>
	);
}
