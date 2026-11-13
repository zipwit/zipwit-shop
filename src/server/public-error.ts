/** Explicitly safe to show to a shopper; infrastructure errors never qualify. */
export class PublicError extends Error {
	constructor(
		message: string,
		readonly values: Record<string, string | number> = {},
	) {
		super(message);
		this.name = "PublicError";
	}
}

export function ensure(
	condition: unknown,
	message: string,
	values?: Record<string, string | number>,
): asserts condition {
	if (!condition) throw new PublicError(message, values);
}
