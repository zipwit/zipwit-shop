import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ConfirmActionDialog } from "#/components/confirm-action-dialog";
import { Container } from "#/components/layout/container";
import { PageHeader } from "#/components/layout/page-header";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { categories, departments } from "#/data/catalog";
import { useTranslation } from "#/i18n/translate";
import type { SavedFeed } from "../catalog-feed";
import { deleteFeedFn, saveFeedFn } from "../catalog-feeds.functions";
import { FeedEditor } from "./feed-editor";

type Action =
	| { kind: "edit"; id: string; feed?: SavedFeed }
	| { kind: "delete"; feed: SavedFeed };

export function FeedManager({ feeds }: { feeds: SavedFeed[] }) {
	const t = useTranslation();
	const router = useRouter();
	const [action, setAction] = useState<Action>();
	const [notice, setNotice] = useState("");
	const save = useServerFn(saveFeedFn);
	const remove = useServerFn(deleteFeedFn);
	const mutation = useMutation({
		mutationFn: async (
			command:
				| { kind: "save"; data: SavedFeed }
				| { kind: "delete"; data: SavedFeed },
		) => {
			if (command.kind === "save") await save({ data: command.data });
			else
				await remove({
					data: { id: command.data.id, revision: command.data.revision },
				});
		},
		onSuccess: async (_, command) => {
			await router.invalidate();
			setAction(undefined);
			setNotice(t(command.kind === "save" ? "Feed saved." : "Feed deleted."));
		},
		onError: () => {
			void router.invalidate();
		},
	});
	function open(next: Action) {
		mutation.reset();
		setNotice("");
		setAction(next);
	}
	const close = () => {
		if (!mutation.isPending) setAction(undefined);
	};
	return (
		<Container className="max-w-5xl py-10 md:py-16">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<PageHeader
					title={t("Catalog feeds")}
					description={t(
						"Choose which retailer pages the worker checks and which offers qualify.",
					)}
				/>
				<Button onClick={() => open({ kind: "edit", id: crypto.randomUUID() })}>
					{t("Add feed")}
				</Button>
			</div>
			<p role="status" className="my-3 min-h-5 text-sm text-muted-foreground">
				{notice}
			</p>
			{feeds.length ? (
				<ul className="divide-y rounded-xl border bg-card px-5">
					{feeds.map((feed) => (
						<li
							key={feed.id}
							className="flex flex-wrap items-center justify-between gap-4 py-5"
						>
							<div className="min-w-0">
								<h2 className="type-title wrap-anywhere text-lg">
									{feed.config.warehouse}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t(departments[feed.config.department].label)} ·{" "}
									{t(categories[feed.config.category].label)} ·{" "}
									{t(feed.enabled ? "Active" : "Paused")}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => open({ kind: "edit", id: feed.id, feed })}
								>
									{t("Edit")}
								</Button>
								<Button
									variant="ghost"
									onClick={() => open({ kind: "delete", feed })}
								>
									{t("Delete")}
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
					{t("Add a feed to start collecting offers.")}
				</p>
			)}
			{action?.kind === "edit" && (
				<Dialog
					open
					onOpenChange={(open) => {
						if (!open) close();
					}}
				>
					<DialogContent
						className="max-h-[90dvh] sm:max-w-xl"
						showCloseButton={!mutation.isPending}
					>
						<DialogHeader>
							<DialogTitle>
								{t(action.feed ? "Edit feed" : "Add feed")}
							</DialogTitle>
						</DialogHeader>
						<FeedEditor
							feed={action.feed}
							error={mutation.error?.message}
							pending={mutation.isPending}
							onCancel={close}
							onSave={(values) =>
								mutation.mutate({
									kind: "save",
									data: {
										id: action.id,
										revision: action.feed?.revision ?? 0,
										...values,
									},
								})
							}
						/>
					</DialogContent>
				</Dialog>
			)}
			{action?.kind === "delete" && (
				<ConfirmActionDialog
					open
					pending={mutation.isPending}
					onDismiss={close}
					onConfirm={() =>
						mutation.mutate({ kind: "delete", data: action.feed })
					}
					icon={<HugeiconsIcon icon={Delete02Icon} />}
					title={t("Delete feed?")}
					confirmLabel={t("Delete")}
					cancelLabel={t("Cancel")}
				>
					{t("Future runs will skip this feed for {{warehouse}}.", {
						warehouse: action.feed.config.warehouse,
					})}
					{mutation.error && (
						<span role="alert" className="block text-destructive">
							{mutation.error.message}
						</span>
					)}
				</ConfirmActionDialog>
			)}
		</Container>
	);
}
