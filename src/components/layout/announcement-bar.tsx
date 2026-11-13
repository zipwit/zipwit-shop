import { DeliveryTruck01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslation } from "#/i18n/translate";
import { Container } from "./container";

export function AnnouncementBar() {
	const t = useTranslation();

	return (
		<section
			aria-label={t("Announcements")}
			className="type-caption text-muted-foreground"
		>
			<Container className="flex min-h-8 items-center justify-center py-1">
				<p className="flex items-center gap-2">
					<HugeiconsIcon
						icon={DeliveryTruck01Icon}
						size={14}
						className="shrink-0"
						aria-hidden="true"
					/>
					<span>{t("U.S. delivery · Shipping calculated at checkout")}</span>
				</p>
			</Container>
		</section>
	);
}
