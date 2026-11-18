type Context = Record<string, unknown>;
type Invocation = { data: unknown; context: Context };
type Middleware = {
	options: {
		middleware?: Middleware[];
		server?: (
			input: Invocation & {
				next: (options?: { context?: Context }) => Promise<unknown>;
			},
		) => unknown;
	};
};

/** Runs middleware and validation in unit tests outside Start's RPC transport. */
export function serverFunctionStub() {
	let parse = (value: unknown): unknown => value;
	let middleware: Middleware[] = [];
	const builder = {
		middleware: (items: Middleware[]) => {
			middleware = items;
			return builder;
		},
		validator: (schema: { parse: typeof parse } | typeof parse) => {
			parse =
				typeof schema === "function" ? schema : (value) => schema.parse(value);
			return builder;
		},
		handler:
			(handler: (input: Invocation) => unknown) =>
			async (options?: { data?: unknown; context?: Context }) => {
				const callbacks: NonNullable<Middleware["options"]["server"]>[] = [];
				const seen = new Set<Middleware>();
				function visit(item: Middleware) {
					if (seen.has(item)) return;
					seen.add(item);
					item.options.middleware?.forEach(visit);
					if (item.options.server) callbacks.push(item.options.server);
				}
				middleware.forEach(visit);
				async function run(index: number, context: Context): Promise<unknown> {
					const callback = callbacks[index];
					if (!callback)
						return handler({ data: parse(options?.data), context });
					return callback({
						data: options?.data,
						context,
						next: (next) => run(index + 1, { ...context, ...next?.context }),
					});
				}
				return run(0, options?.context ?? {});
			},
	};
	return builder;
}
