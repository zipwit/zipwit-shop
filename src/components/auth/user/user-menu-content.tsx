import { useAuth, useSession } from "@better-auth-ui/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { LogIn, LogOut, Settings, UserPlus2 } from "#/components/icons";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "#/components/ui/dropdown-menu";
import { UserView } from "./user-view";

/** Auth states a `UserButton` link can be visible in. */
type UserButtonLinkVisibility = "authenticated" | "unauthenticated" | "always";

/** A simple link entry rendered as a `DropdownMenuItem` in the `UserButton` menu. */
export type UserButtonLink = {
	/** Visible label. */
	label: ReactNode;
	/** Destination URL. */
	href: string;
	/** Optional leading icon. Sized/coloured to match built-in items. */
	icon?: ReactNode;
	/** Forwarded to the underlying `DropdownMenuItem`. */
	variant?: "default" | "destructive";
	/**
	 * When this link is visible based on auth state.
	 * @default "always"
	 */
	visibility?: UserButtonLinkVisibility;
};

function renderUserLink(
	link: UserButtonLink | ReactElement,
	navigate: (options: { to: string; replace?: boolean }) => void,
	fallbackKey: string,
): ReactNode {
	if (isValidElement(link)) return link;

	const { label, href, icon, variant } = link;
	return (
		<DropdownMenuItem
			key={fallbackKey}
			variant={variant}
			onClick={() => navigate({ to: href })}
		>
			{icon}
			{label}
		</DropdownMenuItem>
	);
}

export function UserMenuContent({
	links,
	hideSettings = false,
}: {
	links?: (UserButtonLink | ReactElement)[];
	hideSettings?: boolean;
}) {
	const { authClient, basePaths, viewPaths, localization, plugins, navigate } =
		useAuth();
	const { data: session } = useSession(authClient);
	const userLinks = links?.flatMap((link, index) => {
		if (!isValidElement(link)) {
			const visibility = link.visibility ?? "always";
			if (visibility === "authenticated" && !session) return [];
			if (visibility === "unauthenticated" && session) return [];
		}
		return [
			renderUserLink(link, navigate, `user-button-link-${index.toString()}`),
		];
	});

	// Whether anything renders between the user info label and the
	// sign-out item, so the leading separator isn't shown with nothing
	// to separate (see #439).
	const hasSessionMenuItems =
		(userLinks?.length ?? 0) > 0 ||
		!hideSettings ||
		plugins.some((plugin) => (plugin.userMenuItems?.length ?? 0) > 0);

	return (
		<>
			{session && (
				<>
					<DropdownMenuGroup>
						<DropdownMenuLabel className="text-sm font-normal">
							<UserView />
						</DropdownMenuLabel>
					</DropdownMenuGroup>

					{hasSessionMenuItems && <DropdownMenuSeparator />}
				</>
			)}

			{session ? (
				<>
					{userLinks}

					{!hideSettings && (
						<DropdownMenuItem
							onClick={() =>
								navigate({
									to: `${basePaths.settings}/${viewPaths.settings.account}`,
								})
							}
						>
							<Settings className="text-muted-foreground" />

							{localization.settings.settings}
						</DropdownMenuItem>
					)}

					{plugins.flatMap((plugin) =>
						plugin.userMenuItems?.map((Item, index) => (
							<Item key={`${plugin.id}-${index.toString()}`} />
						)),
					)}

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onClick={() =>
							navigate({
								to: `${basePaths.auth}/${viewPaths.auth.signOut}`,
							})
						}
					>
						<LogOut className="text-muted-foreground" />

						{localization.auth.signOut}
					</DropdownMenuItem>
				</>
			) : (
				<>
					{userLinks}

					<DropdownMenuItem
						onClick={() =>
							navigate({
								to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
							})
						}
					>
						<LogIn className="text-muted-foreground" />

						{localization.auth.signIn}
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={() =>
							navigate({
								to: `${basePaths.auth}/${viewPaths.auth.signUp}`,
							})
						}
					>
						<UserPlus2 className="text-muted-foreground" />

						{localization.auth.signUp}
					</DropdownMenuItem>

					{plugins.flatMap((plugin) =>
						plugin.userMenuItems?.map((Item, index) => (
							<Item key={`${plugin.id}-${index.toString()}`} />
						)),
					)}
				</>
			)}
		</>
	);
}
