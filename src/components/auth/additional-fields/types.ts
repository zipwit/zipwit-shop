import type {
	AdditionalField as AdditionalFieldConfig,
	AdditionalFieldFormValue,
} from "@better-auth-ui/core";
export type AdditionalFieldProps = {
	name: string;
	field: AdditionalFieldConfig;
	value: AdditionalFieldFormValue;
	onBlur: () => void;
	onChange: (value: AdditionalFieldFormValue) => void;
	isInvalid?: boolean;
	errors?: unknown[];
	isPending?: boolean;
	/** Complete suffix appended to labels for fields that are not required. */
	optionalLabel?: string;
};
