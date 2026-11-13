import { useAuth, useSession } from "@better-auth-ui/react";
import type { ReactElement } from "react";
import { ChevronsUpDown } from "#/components/icons";
import { buttonVariants } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/utils";
import { UserAvatar } from "./user-avatar";
import { type UserButtonLink, UserMenuContent } from "./user-menu-content";
import { UserView } from "./user-view";

type UserButtonProps = {
	className?: string;
	align?: "center" | "end" | "start" | undefined;
	side?: "top" | "right" | "bottom" | "left";
	sideOffset?: number;
	size?: "default" | "icon";
	variant?:
		| "default"
		| "destructive"
		| "ghost"
		| "link"
		| "outline"
		| "secondary";
	/** Additional menu entries rendered above the built-in items. */
	links?: (UserButtonLink | ReactElement)[];
	/** Hide the built-in "Settings" link. Useful when replacing it via `links`. */
	hideSettings?: boolean;
};

/**
 * Render a user dropdown button that shows user info, settings, and authentication actions.
 *
 * Includes user profile, settings link, plugin-contributed menu items,
 * and sign-in/sign-up/sign-out actions depending on authentication state.
 *
 * @param className - Additional CSS classes applied to the button trigger
 * @param align - Alignment of the dropdown menu relative to the trigger
 * @param side - Preferred side of the trigger on which to show the dropdown menu
 * @param sideOffset - Offset between the trigger and the dropdown menu
 * @param size - "icon" renders only the avatar; "default" renders a full button with label and chevron
 * @param variant - Visual variant of the trigger button
 * @param links - Additional menu entries rendered above the built-in items
 * @param hideSettings - Hide the built-in "Settings" link
 * @returns The dropdown menu component with user actions
 */
export function UserButton({
	className,
	align = "end",
	side,
	sideOffset = 8,
	size = "default",
	variant = "ghost",
	links,
	hideSettings = false,
}: UserButtonProps) {
	const { authClient, localization } = useAuth();

	const { data: session, isPending: sessionPending } = useSession(authClient);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={size === "icon" ? localization.auth.account : undefined}
				className={
					size === "icon"
						? cn(
								"rounded-full p-1 transition-colors hover:bg-brand/8 data-popup-open:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
								className,
							)
						: cn(
								buttonVariants({ variant, size: "lg" }),
								"py-2.5 h-auto font-normal",
								className,
							)
				}
			>
				{size === "icon" ? (
					<UserAvatar />
				) : (
					<>
						{session || sessionPending ? (
							<UserView />
						) : (
							<>
								<UserAvatar />

								<div className="grid flex-1 text-left text-sm leading-tight">
									{localization.auth.account}
								</div>
							</>
						)}

						<ChevronsUpDown className="ml-auto size-4" />
					</>
				)}
			</DropdownMenuTrigger>

			<DropdownMenuContent
				className="w-64 min-w-56 max-w-[calc(100vw-2rem)]"
				side={side}
				sideOffset={sideOffset}
				align={align}
			>
				<UserMenuContent links={links} hideSettings={hideSettings} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
