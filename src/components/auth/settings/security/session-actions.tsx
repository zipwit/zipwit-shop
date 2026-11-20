import {
	useAuth,
	useRevokeOtherSessions,
	useRevokeSessions,
} from "@better-auth-ui/react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "#/components/confirm-action-dialog";
import { LogOut } from "#/components/icons";
import { Button } from "#/components/ui/button";

type PendingAction = "other" | "all";

export function SessionActions(props: { hasOtherSessions: boolean }) {
	const { authClient, basePaths, localization, navigate, viewPaths } =
		useAuth();
	const [action, setAction] = useState<PendingAction | null>(null);

	const revokeOtherSessions = useRevokeOtherSessions(authClient, {
		onSuccess: () => {
			toast.success(localization.settings.signOutOtherDevicesSuccess);
			setAction(null);
		},
	});
	const revokeSessions = useRevokeSessions(authClient, {
		onSuccess: () =>
			navigate({
				to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
				replace: true,
			}),
	});

	const isPending = revokeOtherSessions.isPending || revokeSessions.isPending;
	const isEverywhere = action === "all";
	const actionLabel = isEverywhere
		? localization.settings.signOutEverywhere
		: localization.settings.signOutOtherDevices;

	return (
		<>
			<div className="flex flex-wrap justify-end gap-2 border-t p-4">
				<Button
					disabled={!props.hasOtherSessions || isPending}
					onClick={() => setAction("other")}
					size="sm"
					type="button"
					variant="outline"
				>
					{localization.settings.signOutOtherDevices}
				</Button>
				<Button
					disabled={isPending}
					onClick={() => setAction("all")}
					size="sm"
					type="button"
					variant="destructive"
				>
					{localization.settings.signOutEverywhere}
				</Button>
			</div>

			<ConfirmActionDialog
				open={action !== null}
				pending={isPending}
				onDismiss={() => setAction(null)}
				onConfirm={() =>
					isEverywhere ? revokeSessions.mutate() : revokeOtherSessions.mutate()
				}
				icon={<LogOut />}
				title={actionLabel}
				confirmLabel={actionLabel}
				cancelLabel={localization.settings.cancel}
				variant={isEverywhere ? "destructive" : "default"}
			>
				{isEverywhere
					? localization.settings.signOutEverywhereDescription
					: localization.settings.signOutOtherDevicesDescription}
			</ConfirmActionDialog>
		</>
	);
}
