import { resolveInputType } from "@better-auth-ui/core";
import type { ComponentType } from "react";
import { DateInput } from "./additional-fields/date-input";
import { InputField } from "./additional-fields/input-field";
import { SliderField } from "./additional-fields/slider-field";
import type { AdditionalFieldProps } from "./additional-fields/types";
import { valueToString } from "./additional-fields/values";

export type { AdditionalFieldProps } from "./additional-fields/types";

import { CheckboxField } from "./additional-fields/checkbox-field";
import { ComboboxField } from "./additional-fields/combobox-field";
import { NumberField } from "./additional-fields/number-field";
import { SelectField } from "./additional-fields/select-field";
import { SwitchField } from "./additional-fields/switch-field";
import { TextareaField } from "./additional-fields/textarea-field";

/** Dispatch configured fields to small, independently maintained controls. */
export function AdditionalField(props: AdditionalFieldProps) {
	const { field: configuredField, optionalLabel } = props;
	const field =
		optionalLabel && !configuredField.required
			? {
					...configuredField,
					label: (
						<>
							{configuredField.label}
							{optionalLabel}
						</>
					),
				}
			: configuredField;
	const resolved = { ...props, field };
	if (field.render) {
		const CustomField = field.render as ComponentType<AdditionalFieldProps>;
		return <CustomField {...resolved} />;
	}
	switch (resolveInputType(field)) {
		case "hidden":
			return (
				<input
					type="hidden"
					name={props.name}
					value={valueToString(props.value)}
					readOnly
				/>
			);
		case "date":
		case "datetime":
			return <DateInput {...resolved} />;
		case "slider":
			return <SliderField {...resolved} />;
		case "textarea":
			return <TextareaField {...resolved} />;
		case "number":
			return <NumberField {...resolved} />;
		case "switch":
			return <SwitchField {...resolved} />;
		case "checkbox":
			return <CheckboxField {...resolved} />;
		case "select":
			return <SelectField {...resolved} />;
		case "combobox":
			return <ComboboxField {...resolved} />;
		default:
			return <InputField {...resolved} />;
	}
}
