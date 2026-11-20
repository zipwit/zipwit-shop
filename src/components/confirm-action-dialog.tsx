import type { ReactNode } from "react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";

/** Keeps a confirmation open during the mutation. The caller handles success and dismissal. */
export function ConfirmActionDialog({
	open,
	pending,
	onDismiss,
	onConfirm,
	icon,
	title,
	children,
	cancelLabel,
	confirmLabel,
	variant = "destructive",
}: {
	open: boolean;
	pending: boolean;
	onDismiss: () => void;
	onConfirm: () => void;
	icon: ReactNode;
	title: string;
	children: ReactNode;
	cancelLabel: string;
	confirmLabel: string;
	variant?: "default" | "destructive";
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !pending) onDismiss();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
						{icon}
					</AlertDialogMedia>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{children}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>
						{cancelLabel}
					</AlertDialogCancel>
					<Button
						type="button"
						variant={variant}
						disabled={pending}
						onClick={onConfirm}
					>
						{pending && <Spinner />}
						{confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
