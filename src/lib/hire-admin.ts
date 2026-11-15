import type { HireAgreementRecord, HireAgreementSummary, PaymentMethod } from "./hire-agreement";
import { agreementSummary, formatMoney } from "./hire-agreement";

export const ADMIN_COOKIE = "lvh_admin";
export const ADMIN_HOME = "/admin/bookings";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function isAdminLoginPath(pathname: string): boolean {
	return pathname.replace(/\/+$/, "") === "/admin/login";
}

export function safeAdminNext(path: string): string {
	const pathname = path.split("?")[0]?.split("#")[0] ?? "";
	if (!pathname.startsWith("/admin")) return ADMIN_HOME;
	const trimmed = pathname.replace(/\/+$/, "") || "/";
	if (trimmed === "/admin" || trimmed === "/admin/login") return ADMIN_HOME;
	return trimmed;
}

export type AdminFieldType = "text" | "textarea" | "date" | "time" | "email" | "tel" | "number" | "yesno" | "checkbox" | "payment" | "alcohol";

export type AdminField = {
	key: keyof HireAgreementRecord;
	label: string;
	type: AdminFieldType;
};

export type AdminFieldGroup = {
	title: string;
	fields: AdminField[];
};

export const ADMIN_FIELD_GROUPS: AdminFieldGroup[] = [
	{
		title: "Hirer",
		fields: [
			{ key: "hirerName", label: "Name", type: "text" },
			{ key: "organisation", label: "Organisation", type: "text" },
			{ key: "position", label: "Position", type: "text" },
			{ key: "addressLine1", label: "Address line 1", type: "text" },
			{ key: "addressLine2", label: "Address line 2", type: "text" },
			{ key: "town", label: "Town or city", type: "text" },
			{ key: "county", label: "County", type: "text" },
			{ key: "postcode", label: "Postcode", type: "text" },
			{ key: "telephone", label: "Telephone", type: "tel" },
			{ key: "mobile", label: "Mobile", type: "tel" },
			{ key: "email", label: "Email", type: "email" },
		],
	},
	{
		title: "Hire",
		fields: [
			{ key: "hireDate", label: "Date", type: "date" },
			{ key: "timeFrom", label: "Time from", type: "time" },
			{ key: "timeTo", label: "Time to", type: "time" },
			{ key: "functionType", label: "Type of function", type: "text" },
			{ key: "numberAttending", label: "Total number attending", type: "number" },
		],
	},

	{
		title: "Facilities",
		fields: [
			{ key: "johnWrightHall", label: "John Wright Hall", type: "yesno" },
			{ key: "brianPoultneyHall", label: "Brian Poultney Hall", type: "yesno" },
			{ key: "kitchen", label: "Kitchen", type: "yesno" },
			{ key: "stage", label: "Stage", type: "yesno" },
			{ key: "inflatable", label: "Hiring an inflatable", type: "yesno" },
			{ key: "largeTables", label: "Large tables", type: "number" },
			{ key: "standardChairs", label: "Standard chairs", type: "number" },
			{ key: "smallTables", label: "Small tables", type: "number" },
			{ key: "nurseryTables", label: "Nursery tables", type: "number" },
			{ key: "nurseryChairs", label: "Nursery chairs", type: "number" },
			{ key: "crockery", label: "Crockery", type: "yesno" },
			{ key: "entertainment", label: "Entertainment or other activity", type: "textarea" },
		],
	},
	{
		title: "Music and alcohol",
		fields: [
			{ key: "musicPlayed", label: "Music played", type: "yesno" },
			{ key: "musicCeaseTime", label: "Music cease time", type: "time" },
			{ key: "alcoholConsumed", label: "Alcohol consumed", type: "yesno" },
			{ key: "alcoholSupply", label: "Alcohol sold or free", type: "alcohol" },
			{ key: "tenAcknowledged", label: "Temporary Event Notice confirmed", type: "checkbox" },
		],
	},
	{
		title: "Hiring charge",
		fields: [
			{ key: "depositDue", label: "Deposit due", type: "text" },
			{ key: "amountPaid", label: "Amount paid", type: "text" },
			{ key: "balanceDue", label: "Balance due", type: "text" },
		],
	},
	{
		title: "Payment and signature",
		fields: [
			{ key: "paymentMethod", label: "Payment method", type: "payment" },
			{ key: "publicLiabilityRead", label: "Public liability terms read", type: "checkbox" },
			{ key: "healthSafetyAgreed", label: "Health and safety agreed", type: "checkbox" },
			{ key: "conditionsAgreed", label: "Conditions of Hire agreed", type: "checkbox" },
			{ key: "signedDate", label: "Signed date", type: "date" },
		],
	},
];

export function formatAgreementValue(key: keyof HireAgreementRecord, value: HireAgreementRecord[keyof HireAgreementRecord]): string {
	if (value === true) return "Yes";
	if (value === false) return "No";
	if (value === "yes") return "Yes";
	if (value === "no") return "No";
	if (typeof value !== "string" || !value.trim()) return "—";

	if (key === "hireDate" || key === "signedDate") return formatDisplayDate(value);
	if (key === "depositDue" || key === "amountPaid" || key === "balanceDue") return formatMoney(value);
	if (key === "alcoholSupply") return value === "sold" ? "Sold" : value === "free" ? "Free" : value;
	if (key === "paymentMethod") return paymentLabel(value as PaymentMethod);
	return value;
}

export function formatDisplayDate(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatStatus(status: HireAgreementRecord["status"]): string {
	return status === "submitted" ? "Submitted" : "Draft";
}

export function summariesFromRecords(records: HireAgreementRecord[]): HireAgreementSummary[] {
	return records.map(agreementSummary);
}

export async function createAdminCookie(secret: string, secure: boolean): Promise<string> {
	const expiry = String(Date.now() + SESSION_MS);
	const signature = await sign(secret, expiry);
	const parts = [`${ADMIN_COOKIE}=${expiry}.${signature}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(SESSION_MS / 1000)}`];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function clearAdminCookie(secure: boolean): string {
	const parts = [`${ADMIN_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export async function isAdminCookieValid(cookieHeader: string | null | undefined, secret: string): Promise<boolean> {
	const token = readCookie(cookieHeader, ADMIN_COOKIE);
	if (!token || !secret) return false;
	const [expiry, signature] = token.split(".");
	if (!expiry || !signature || Number(expiry) < Date.now()) return false;
	const expected = await sign(secret, expiry);
	return timingEqual(signature, expected);
}

export function passwordsMatch(provided: string, secret: string): boolean {
	return Boolean(secret) && timingEqual(provided, secret);
}

export function readCookie(header: string | null | undefined, name: string): string {
	if (!header) return "";
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return "";
}

function paymentLabel(value: PaymentMethod): string {
	if (value === "cash") return "Cash";
	if (value === "cheque") return "Cheque";
	if (value === "bank") return "Online banking";
	if (value === "later") return "Arrange with the booking secretary";
	return value;
}

async function sign(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingEqual(left: string, right: string): boolean {
	const max = Math.max(left.length, right.length);
	let diff = left.length === right.length ? 0 : 1;
	for (let index = 0; index < max; index += 1) {
		diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
	}
	return diff === 0;
}
