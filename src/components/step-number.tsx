export function StepNumber({ index }: { index: number }) {
	return (
		<span
			aria-hidden="true"
			className="type-num text-base font-medium text-brand"
		>
			{String(index + 1).padStart(2, "0")}
		</span>
	);
}
