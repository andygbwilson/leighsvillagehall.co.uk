import type { HallRoom } from "../lib/bookings";
import { adminFetch, bindAdminLogout } from "./admin-session";

function initAdminRooms() {
	const rows = document.querySelector<HTMLElement>("[data-room-rows]");
	const form = document.querySelector<HTMLFormElement>("[data-rooms-form]");
	const banner = document.querySelector<HTMLElement>("[data-admin-banner]");
	const add = document.querySelector<HTMLButtonElement>("[data-add-room]");
	if (!rows || !form || !banner) return;
	bindAdminLogout();
	let rooms: HallRoom[] = [];

	const showBanner = (message: string, kind: "error" | "info" = "info") => {
		banner.hidden = !message;
		banner.textContent = message;
		banner.classList.toggle("is-error", kind === "error");
	};

	const slug = (value: string) =>
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || `room-${rooms.length + 1}`;

	const render = () => {
		rows.innerHTML = rooms
			.map(
				(room, index) => `
          <tr>
            <td><input type="checkbox" data-public="${index}" ${room.public ? "checked" : ""} /></td>
            <td><input data-short="${index}" value="${escapeHtml(room.shortName)}" /></td>
            <td><input data-full="${index}" value="${escapeHtml(room.fullName)}" /></td>
            <td><input type="color" data-colour="${index}" value="${escapeHtml(room.colour)}" /></td>
            <td><button class="button button-sm button-secondary" type="button" data-remove="${index}">Remove</button></td>
          </tr>
        `,
			)
			.join("");
		rows.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.dataset.remove);
				if (rooms.length < 2) return;
				rooms = rooms.filter((_, item) => item !== index);
				render();
			});
		});
	};

	const read = (): HallRoom[] =>
		rooms.map((room, index) => ({
			...room,
			public: Boolean(rows.querySelector<HTMLInputElement>(`[data-public="${index}"]`)?.checked),
			shortName: rows.querySelector<HTMLInputElement>(`[data-short="${index}"]`)?.value ?? room.shortName,
			fullName: rows.querySelector<HTMLInputElement>(`[data-full="${index}"]`)?.value ?? room.fullName,
			colour: rows.querySelector<HTMLInputElement>(`[data-colour="${index}"]`)?.value ?? room.colour,
			sort: index + 1,
		}));

	add?.addEventListener("click", () => {
		rooms = read();
		rooms.push({
			id: slug(`room-${Date.now()}`),
			shortName: "New",
			fullName: "New room",
			colour: "#6b7280",
			public: true,
			sort: rooms.length + 1,
		});
		render();
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		showBanner("");
		rooms = read();
		void adminFetch("/api/admin/rooms", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ rooms }),
		})
			.then((result) => {
				rooms = (result as { rooms: HallRoom[] }).rooms;
				render();
				showBanner("Rooms saved.");
			})
			.catch((caught: Error) => showBanner(caught.message, "error"));
	});

	void adminFetch("/api/admin/rooms")
		.then((result) => {
			rooms = (result as { rooms: HallRoom[] }).rooms;
			render();
		})
		.catch((caught: Error) => showBanner(caught.message, "error"));
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (typeof document !== "undefined") initAdminRooms();
