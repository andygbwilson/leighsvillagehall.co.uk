import {
	emptyHireAgreement,
	isValidBookingNumber,
	normaliseHireAgreement,
	splitAddress,
	type HireAgreementRecord,
	type YesNo,
} from "./hire-agreement";

export type ParsedHboBooking = {
	bookingNumber: string;
	hirerName: string;
	email: string;
	telephone: string;
	address: string;
	hireDate: string;
	timeFrom: string;
	timeTo: string;
	functionType: string;
	numberAttending: string;
	johnWrightHall: YesNo;
	brianPoultneyHall: YesNo;
	notes: string;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+44|0)\d[\d\s-]{8,14}\d/;

export function looksLikeHboBookingEmail(text: string): boolean {
	const body = text.toLowerCase();
	return (
		body.includes("there is a new booking for leighs village hall") ||
		(body.includes("original booking data") && body.includes("hallbookingonline.com"))
	);
}

export function senderLooksLikeHbo(from: string, allowedDomain = "hallbookingonline.com"): boolean {
	return from.toLowerCase().includes(allowedDomain.toLowerCase());
}

export function parseInviteAllowlist(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
}

export function isInviteAllowed(email: string, allowlist: string[]): boolean {
	if (allowlist.length === 0) return true;
	return allowlist.includes(email.trim().toLowerCase());
}

export function parseHboBookingEmail(text: string): ParsedHboBooking | null {
	const body = normaliseEmailText(text);
	if (!looksLikeHboBookingEmail(body)) return null;

	const original = sectionAfter(body, /original booking data/i);
	const human = sectionBefore(body, /original booking data/i) || body;

	const bookingNumber =
		fieldValue(original, /^I\s*D\s*:/im) ||
		fieldValue(original, /^ID\s*:/im) ||
		firstMatch(body, /[?&]id=(\d{2,10})/i) ||
		firstMatch(body, /\bID\s*:\s*(\d{2,10})/i);

	if (!bookingNumber || !isValidBookingNumber(bookingNumber)) return null;

	const hireDate = toHtmlDate(fieldValue(original, /^Date\s*:/im)) || toHtmlDate(fieldValue(human, /^Date\s*:/im));

	const timeFrom = toHtmlTime(fieldValue(original, /^>?From\s*:/im)) || toHtmlTime(firstMatch(human, /Time:\s*From\s+([0-9apm:.\s]+)\s+to/i));

	const timeTo =
		toHtmlTime(fieldValue(original, /^To\s*:/im)) || toHtmlTime(firstMatch(human, /Time:\s*From\s+[0-9apm:.\s]+\s+to\s+([0-9apm:.\s]+)/i));

	const facilities = fieldValue(human, /^Facilities\s*:/im);
	const contact = parseContactInfo(human);

	return {
		bookingNumber,
		hirerName: fieldValue(human, /^Name\s*:/im),
		email: contact.email,
		telephone: contact.telephone,
		address: contact.address,
		hireDate,
		timeFrom,
		timeTo,
		functionType: fieldValue(human, /^Event Title\s*:/im),
		numberAttending: fieldValue(human, /^Number Attending\s*:/im),
		johnWrightHall: /john\s*wright/i.test(facilities) ? "yes" : "",
		brianPoultneyHall: /brian\s*poultney/i.test(facilities) ? "yes" : "",
		notes: fieldValue(human, /^Notes\s*:/im),
	};
}

export function applyBookingPrefill(existing: HireAgreementRecord | null, booking: ParsedHboBooking): HireAgreementRecord {
	const base = existing ?? emptyHireAgreement(booking.bookingNumber);
	if (base.status === "submitted") return base;

	const fill = (current: string, next: string) => (current.trim() ? current : next);
	const current = normaliseHireAgreement(base);
	const parsedAddress = splitAddress(booking.address);

	return normaliseHireAgreement({
		...current,
		bookingNumber: booking.bookingNumber,
		hirerName: fill(current.hirerName, booking.hirerName),
		email: fill(current.email, booking.email),
		telephone: fill(current.telephone, booking.telephone),
		mobile: fill(current.mobile, booking.telephone),
		addressLine1: fill(current.addressLine1, parsedAddress.addressLine1),
		addressLine2: fill(current.addressLine2, parsedAddress.addressLine2),
		town: fill(current.town, parsedAddress.town),
		county: fill(current.county, parsedAddress.county),
		postcode: fill(current.postcode, parsedAddress.postcode),
		hireDate: fill(current.hireDate, booking.hireDate),
		timeFrom: fill(current.timeFrom, booking.timeFrom),
		timeTo: fill(current.timeTo, booking.timeTo),
		functionType: fill(current.functionType, booking.functionType),
		numberAttending: fill(current.numberAttending, booking.numberAttending),
		johnWrightHall: fill(current.johnWrightHall, booking.johnWrightHall) as YesNo,
		brianPoultneyHall: fill(current.brianPoultneyHall, booking.brianPoultneyHall) as YesNo,
		entertainment: fill(current.entertainment, booking.notes),
		status: "draft",
		updatedAt: new Date().toISOString(),
	});
}

export type HireInviteSource = Pick<
	HireAgreementRecord,
	"bookingNumber" | "hirerName" | "email" | "hireDate" | "timeFrom" | "timeTo" | "functionType" | "depositDue"
>;

export function hireAgreementUrl(origin: string, bookingNumber: string): string {
	return `${origin.replace(/\/$/, "")}/hire-agreement?booking=${encodeURIComponent(bookingNumber)}`;
}

export function hireAdminAgreementUrl(origin: string, bookingNumber: string): string {
	return `${origin.replace(/\/$/, "")}/admin/agreement?booking=${encodeURIComponent(bookingNumber)}`;
}

export function buildStaffBookingNotice(
	booking: Pick<HireAgreementRecord, "bookingNumber" | "hirerName" | "email" | "hireDate" | "timeFrom" | "timeTo" | "functionType">,
	adminUrl: string,
) {
	const when = [formatDisplayDate(booking.hireDate), formatDisplayTimeRange(booking.timeFrom, booking.timeTo)].filter(Boolean).join(", ");
	const event = booking.functionType || "Not specified";
	const hirer = booking.hirerName || "Not specified";
	const email = booking.email || "Not specified";

	const text = [
		"A new provisional booking is ready to set up.",
		"",
		`Booking number: ${booking.bookingNumber}`,
		`Hirer: ${hirer}`,
		`Email: ${email}`,
		when ? `When: ${when}` : "",
		`Event: ${event}`,
		"",
		"Review the booking, add the deposit due, then send the hire agreement invite:",
		adminUrl,
		"",
		"Leighs Village Hall",
	]
		.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
		.join("\n")
		.trim();

	const html = `
    <p>A new provisional booking has been received and the hire agreement is ready to set up.</p>
    <p>
      <strong>Booking number:</strong> ${escapeHtml(booking.bookingNumber)}<br>
      <strong>Hirer:</strong> ${escapeHtml(hirer)}<br>
      <strong>Email:</strong> ${escapeHtml(email)}<br>
      ${when ? `<strong>When:</strong> ${escapeHtml(when)}<br>` : ""}
      <strong>Event:</strong> ${escapeHtml(event)}
    </p>
    <p>Review the booking, add the deposit due, then send the hire agreement invite:</p>
    <p><a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></p>
    <p>Leighs Village Hall</p>
  `.replace(/\n\s+/g, "\n");

	return {
		subject: `New provisional booking ${booking.bookingNumber} needs setting`,
		text,
		html,
	};
}

export function assertCanSendInvite(record: HireInviteSource, allowlist: string[]): string {
	const email = record.email.trim();
	if (!email) {
		throw new Error("Add the hirer’s email address before sending the invite.");
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new Error("Enter a valid email address before sending the invite.");
	}
	if (!isInviteAllowed(email, allowlist)) {
		throw new Error("That email is not on the invite allowlist.");
	}
	if (!record.depositDue?.trim()) {
		throw new Error("Add the deposit due before sending the invite.");
	}
	return email;
}

export function buildHireInvite(booking: HireInviteSource, formUrl: string) {
	const when = [formatDisplayDate(booking.hireDate), formatDisplayTimeRange(booking.timeFrom, booking.timeTo)].filter(Boolean).join(", ");
	const event = booking.functionType || "your event";

	const text = [
		`Hello ${booking.hirerName || "there"},`,
		"",
		"Thank you for your provisional booking of Leighs Village Hall.",
		"",
		when ? `When: ${when}` : "",
		`Event: ${event}`,
		`Booking number: ${booking.bookingNumber}`,
		"",
		"To confirm the booking, please complete the hire agreement using this link:",
		formUrl,
		"",
		"We've filled in the details from your enquiry. Please check them, add anything still needed, and submit the form. Facilities in section 6 can be left blank and finished later.",
		"",
		"If you have questions, reply to this email or call Stuart Wilson on 01245 364193.",
		"",
		"Leighs Village Hall",
		"Charity no. 301317",
	]
		.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
		.join("\n")
		.trim();

	const html = `
    <p>Hello ${escapeHtml(booking.hirerName || "there")},</p>
    <p>Thank you for your provisional booking of Leighs Village Hall.</p>
    <p>
      ${when ? `<strong>When:</strong> ${escapeHtml(when)}<br>` : ""}
      <strong>Event:</strong> ${escapeHtml(event)}<br>
      <strong>Booking number:</strong> ${escapeHtml(booking.bookingNumber)}
    </p>
    <p>To confirm the booking, please complete the hire agreement:</p>
    <p><a href="${escapeHtml(formUrl)}">${escapeHtml(formUrl)}</a></p>
    <p>We've filled in the details from your enquiry. Please check them, add anything still needed, and submit the form. Facilities in section 6 can be left blank and finished later.</p>
    <p>If you have questions, reply to this email or call Stuart Wilson on 01245 364193.</p>
    <p>Leighs Village Hall<br>Charity no. 301317</p>
  `.replace(/\n\s+/g, "\n");

	return {
		subject: `Complete your hire agreement for Leighs Village Hall (booking ${booking.bookingNumber})`,
		text,
		html,
	};
}

function parseContactInfo(human: string): { email: string; telephone: string; address: string } {
	const block = firstMatch(human, /Contact Info\s*([\s\S]*?)(?=\nNotes:|\nFollow this link|$)/i) ?? "";
	const lines = block
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	let email = "";
	let telephone = "";
	const addressLines: string[] = [];

	for (const line of lines) {
		const foundEmail = line.match(EMAIL_PATTERN)?.[0] ?? "";
		const foundPhone = line.match(PHONE_PATTERN)?.[0] ?? "";
		if (!email && foundEmail) {
			email = foundEmail;
			continue;
		}
		if (!telephone && foundPhone) {
			telephone = foundPhone.replace(/\s+/g, "");
			continue;
		}
		addressLines.push(line);
	}

	if (!email) email = human.match(EMAIL_PATTERN)?.[0] ?? "";
	if (!telephone) telephone = (human.match(PHONE_PATTERN)?.[0] ?? "").replace(/\s+/g, "");

	return { email, telephone, address: addressLines.join("\n") };
}

function fieldValue(source: string, pattern: RegExp): string {
	const match = source.match(pattern);
	if (!match) return "";
	const line = match[0];
	const start = match.index ?? 0;
	const rest = source.slice(start + line.length);
	const value = rest.split("\n")[0] ?? "";
	return value.replace(/^[:\s]+/, "").trim();
}

function firstMatch(source: string, pattern: RegExp): string {
	return source.match(pattern)?.[1]?.trim() ?? "";
}

function sectionAfter(source: string, pattern: RegExp): string {
	const match = source.match(pattern);
	if (!match || match.index == null) return "";
	return source.slice(match.index + match[0].length);
}

function sectionBefore(source: string, pattern: RegExp): string {
	const match = source.match(pattern);
	if (!match || match.index == null) return source;
	return source.slice(0, match.index);
}

function toHtmlDate(value: string): string {
	const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	const parsed = Date.parse(value.replace(/^[A-Za-z]{3,9},?\s+/, ""));
	if (Number.isNaN(parsed)) return "";
	return new Date(parsed).toISOString().slice(0, 10);
}

function toHtmlTime(value: string): string {
	const trimmed = value.trim().replace(/\./g, "");
	const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
	if (twentyFour) return `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}`;

	const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
	if (!ampm) return "";
	let hour = Number(ampm[1]);
	const minutes = ampm[2];
	const meridiem = ampm[3].toLowerCase();
	if (meridiem === "pm" && hour < 12) hour += 12;
	if (meridiem === "am" && hour === 12) hour = 0;
	return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function formatDisplayDate(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = new Date(`${value}T12:00:00`);
	return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDisplayTimeRange(from: string, to: string): string {
	if (!from || !to) return "";
	return `${from} to ${to}`;
}

function normaliseEmailText(text: string): string {
	return text
		.replace(/\r\n/g, "\n")
		.replace(/\u00a0/g, " ")
		.trim();
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
