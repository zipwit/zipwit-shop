import { CartButton } from "#/features/cart/components/cart-button";
import { AccountLink } from "./account-link";
import { Container } from "./container";
import { DesktopNav } from "./desktop-nav";
import { LanguageSelector } from "./language-selector";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export function Header() {
	return (
		<header className="site-header sticky top-0 z-40 text-foreground">
			<Container className="flex h-18 items-center justify-between gap-2 sm:gap-4 md:h-20">
				<div className="flex min-w-0 items-center gap-8">
					<Logo className="h-9 md:h-10" />
					<DesktopNav />
				</div>

				<div className="flex items-center gap-1 sm:gap-2">
					<AccountLink />
					<CartButton />
					<MobileMenu />
					<LanguageSelector />
				</div>
			</Container>
		</header>
	);
}
