import {
	formatMoney,
	normaliseHireAgreement,
	type HireAgreementPayload,
	type HireAgreementRecord,
	type YesNo,
} from "../lib/hire-agreement";

const API = "/api/hire-agreement";

function initHireAgreement() {
	const gate = document.querySelector<HTMLFormElement>("[data-hire-gate]");
	const form = document.querySelector<HTMLFormElement>("[data-hire-form]");
	const banner = document.querySelector<HTMLElement>("[data-hire-banner]");
	const hero = document.querySelector<HTMLElement>("[data-hire-hero]");
	const success = document.querySelector<HTMLElement>("[data-hire-success]");
	const successCopy = document.querySelector<HTMLElement>("[data-hire-success-copy]");
	const refLabel = document.querySelector<HTMLElement>("[data-hire-ref]");
	if (!gate || !form || !banner || !hero || !success || !successCopy || !refLabel) return;

	const params = new URLSearchParams(window.location.search);
	let bookingNumber = (params.get("booking") ?? params.get("ref") ?? "").trim();

	const showBanner = (message: string, kind: "error" | "info" = "error") => {
		banner.hidden = !message;
		banner.textContent = message;
		banner.classList.toggle("is-error", Boolean(message) && kind === "error");
	};

	const applyConditional = () => {
		form.querySelectorAll<HTMLElement>("[data-show-when]").forEach((node) => {
			const [name, value] = (node.dataset.showWhen ?? "").split(":");
			node.hidden = formValue(form, name) !== value;
		});

		form.querySelectorAll<HTMLInputElement>("[data-required-when]").forEach((field) => {
			const [name, value] = (field.dataset.requiredWhen ?? "").split(":");
			field.required = formValue(form, name) === value;
		});
	};

	const fillForm = (record: HireAgreementRecord) => {
		const elements = form.elements;
		(Object.keys(record) as (keyof HireAgreementRecord)[]).forEach((key) => {
			const field = elements.namedItem(String(key));
			const value = record[key];
			if (!field) return;
			if (field instanceof RadioNodeList) {
				field.value = String(value ?? "");
				return;
			}
			if (field instanceof HTMLInputElement && field.type === "checkbox") {
				field.checked = Boolean(value);
				return;
			}
			if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
			const text = value == null ? "" : String(value);
			field.value = key === "depositDue" || key === "balanceDue" ? formatMoney(text) : text;
		});
		applyConditional();
	};

	const readForm = (): HireAgreementPayload => {
		const data = new FormData(form);
		const yesNo = (name: string): YesNo => {
			const value = String(data.get(name) ?? "");
			return value === "yes" || value === "no" ? value : "";
		};
		const payment = String(data.get("paymentMethod") ?? "");
		const supply = String(data.get("alcoholSupply") ?? "");

		return {
			bookingNumber,
			hirerName: String(data.get("hirerName") ?? ""),
			organisation: String(data.get("organisation") ?? ""),
			position: String(data.get("position") ?? ""),
			addressLine1: String(data.get("addressLine1") ?? ""),
			addressLine2: String(data.get("addressLine2") ?? ""),
			town: String(data.get("town") ?? ""),
			county: String(data.get("county") ?? ""),
			postcode: String(data.get("postcode") ?? ""),
			telephone: String(data.get("telephone") ?? ""),
			email: String(data.get("email") ?? ""),
			functionType: String(data.get("functionType") ?? ""),
			numberAttending: String(data.get("numberAttending") ?? ""),
			johnWrightHall: yesNo("johnWrightHall"),
			brianPoultneyHall: yesNo("brianPoultneyHall"),
			kitchen: yesNo("kitchen"),
			stage: yesNo("stage"),
			inflatable: yesNo("inflatable"),
			largeTables: String(data.get("largeTables") ?? ""),
			standardChairs: String(data.get("standardChairs") ?? ""),
			smallTables: String(data.get("smallTables") ?? ""),
			nurseryTables: String(data.get("nurseryTables") ?? ""),
			nurseryChairs: String(data.get("nurseryChairs") ?? ""),
			crockery: yesNo("crockery"),
			entertainment: String(data.get("entertainment") ?? ""),
			musicPlayed: yesNo("musicPlayed"),
			musicCeaseTime: String(data.get("musicCeaseTime") ?? ""),
			alcoholConsumed: yesNo("alcoholConsumed"),
			alcoholSupply: supply === "sold" || supply === "free" ? supply : "",
			tenAcknowledged: data.get("tenAcknowledged") === "true",
			paymentMethod: payment === "cash" || payment === "cheque" || payment === "bank" || payment === "later" ? payment : "",
			publicLiabilityRead: data.get("publicLiabilityRead") === "true",
			healthSafetyAgreed: data.get("healthSafetyAgreed") === "true",
			conditionsAgreed: data.get("conditionsAgreed") === "true",
			signedDate: String(data.get("signedDate") ?? ""),
			mobile: String(data.get("mobile") ?? ""),
		};
	};

	const save = async () => {
		const response = await fetch(API, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(readForm()),
		});
		const result = (await response.json()) as { error?: string; record?: HireAgreementRecord };
		if (!response.ok || !result.record) {
			throw new Error(result.error ?? "The hire agreement could not be saved.");
		}
		return result.record;
	};

	const openForm = async (number: string) => {
		bookingNumber = number.trim();
		const url = new URL(window.location.href);
		url.searchParams.set("booking", bookingNumber);
		window.history.replaceState({}, "", url);

		gate.hidden = true;
		form.hidden = false;
		(form.elements.namedItem("bookingNumber") as HTMLInputElement).value = bookingNumber;
		refLabel.textContent = bookingNumber;

		const signedDate = form.elements.namedItem("signedDate") as HTMLInputElement;

		const response = await fetch(`${API}?booking=${encodeURIComponent(bookingNumber)}`);
		const result = (await response.json()) as { found?: boolean; record?: HireAgreementRecord; error?: string };
		if (!response.ok) {
			showBanner(result.error ?? "That booking number could not be used.");
			return;
		}
		if (result.found && result.record) {
			fillForm(normaliseHireAgreement(result.record));
		}
		if (!signedDate.value) signedDate.value = new Date().toISOString().slice(0, 10);
		if (result.found && result.record) {
			showBanner(
				result.record.status === "submitted"
					? "This agreement is already saved. You can update it if necessary."
					: result.record.inviteSentAt
						? "We've filled in the details from your booking. Please check them and complete the rest of the agreement."
						: "We found a started agreement for this booking. You can continue from here.",
				"info",
			);
		}
		applyConditional();
	};

	gate.addEventListener("submit", (event) => {
		event.preventDefault();
		const value = String(new FormData(gate).get("bookingNumber") ?? "");
		if (!value.trim()) {
			showBanner("Enter the booking number from your confirmation email.");
			return;
		}
		void openForm(value).catch((error: Error) => showBanner(error.message));
	});

	form.addEventListener("change", applyConditional);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		applyConditional();
		if (!form.reportValidity()) return;
		showBanner("");
		void save()
			.then((record) => {
				form.hidden = true;
				banner.hidden = true;
				hero.hidden = true;
				success.hidden = false;
				successCopy.textContent = `Your hire agreement has been stored against booking ${record.bookingNumber}. If you still need to add tables, chairs or rooms, reopen this link and complete section 6.`;
			})
			.catch((error: Error) => showBanner(error.message));
	});

	if (bookingNumber) {
		void openForm(bookingNumber).catch((error: Error) => showBanner(error.message));
	}
}

function formValue(form: HTMLFormElement, name: string): string {
	const field = form.elements.namedItem(name);
	if (field instanceof RadioNodeList) return field.value;
	if (field instanceof HTMLInputElement) {
		if (field.type === "checkbox") return field.checked ? field.value : "";
		return field.value;
	}
	return "";
}

if (typeof document !== "undefined") {
	initHireAgreement();
}
