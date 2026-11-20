import { normalizeAuthFormServerError } from "@better-auth-ui/core";
import type { AnyFormApi } from "@tanstack/react-form";

export function isFieldInvalid({
	isTouched,
	isValid,
}: {
	isTouched: boolean;
	isValid: boolean;
}) {
	return isTouched && !isValid;
}

function setFormServerError(
	form: AnyFormApi,
	error: unknown,
	fallbackMessage: string,
) {
	const normalized = normalizeAuthFormServerError(error, fallbackMessage);
	form.setErrorMap({
		onServer: {
			fields: normalized.fields ?? {},
			form: normalized.form,
		},
	});
}

function clearFormServerError(form: AnyFormApi) {
	form.setErrorMap({ onServer: { fields: {} } });
}

/** Drops the server's complaint about one field as soon as the shopper edits it. */
export function clearFieldServerError(form: AnyFormApi, fieldName: string) {
	form.setErrorMap({ onServer: undefined });
	if (!fieldName) return;

	const fieldMeta = form.getFieldMeta(fieldName as never);
	if (!fieldMeta?.errorMap.onServer) return;

	form.setFieldMeta(fieldName as never, (current = fieldMeta) => ({
		...current,
		errorMap: { ...current.errorMap, onServer: undefined },
		errorSourceMap: { ...current.errorSourceMap, onServer: undefined },
	}));
}

export async function submitForm(form: AnyFormApi, fallbackMessage: string) {
	clearFormServerError(form);
	try {
		await form.handleSubmit();
		return form.state.isValid;
	} catch (error) {
		if (!form.state.errorMap.onServer) {
			setFormServerError(form, error, fallbackMessage);
		}
		return false;
	}
}
