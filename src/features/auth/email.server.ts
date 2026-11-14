import { escape as escapeHtml } from "es-toolkit";
import { Resend } from "resend";
import { DEFAULT_LOCALE, type Locale } from "#/i18n/locale-config";
import { translate as t } from "#/i18n/translate";
import { env } from "#/server/env.server";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type Email = { subject: string; html: string };

export async function sendEmail({ to, subject, html }: Email & { to: string }) {
	if (!resend) {
		// Only reachable in development; production requires the key.
		console.info(`[email not sent] to=${to} subject=${subject}\n${html}`);
		return;
	}

	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html,
	});

	if (error) {
		console.error("Failed to send email:", error);
		throw new Error(t("Unable to send email. Please try again."));
	}
}

/** Transactional email bodies, kept out of the auth configuration. */
export const emailTemplates = {
	code: (
		otp: string,
		type: string,
		locale: Locale = DEFAULT_LOCALE,
	): Email => ({
		subject:
			type === "forget-password"
				? t("Your password reset code", {}, locale)
				: t("Your email verification code", {}, locale),
		html: `<div lang="${locale}"><p>${t("Your confirmation code is", {}, locale)} <strong>${escapeHtml(otp)}</strong>.</p><p>${t("It expires in 5 minutes. If you didn't request this, ignore this email.", {}, locale)}</p></div>`,
	}),

	approveEmailChange: (
		newEmail: string,
		url: string,
		locale: Locale = DEFAULT_LOCALE,
	): Email => ({
		subject: t("Approve your email change", {}, locale),
		html: `<div lang="${locale}"><p>${t("You asked to change your email to {{email}}.", { email: escapeHtml(newEmail) }, locale)} <a href="${escapeHtml(url)}">${t("Approve the change", {}, locale)}</a>. ${t("If this wasn't you, ignore this email.", {}, locale)}</p></div>`,
	}),
};
