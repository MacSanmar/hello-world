// UI-laag: dunne schil over logic.js en storage.js.
// Rendert alles opnieuw bij elke wijziging (dataset is klein) en raakt
// user-data nooit via innerHTML aan — alle nodes via el() + textContent.

import * as L from "./logic.js";
import { createStorage, detectBackend } from "./storage.js";

// ---------------------------------------------------------------------------
// Opstart
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo") === "1";

const { backend, persistent } = detectBackend();
const storage = createStorage(backend);

let state = DEMO ? demoState() : storage.load();
let filter = { query: "", status: "all" };
const expanded = new Set(); // persoon-ids met open detailpaneel
let editingId = null;

const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// Kleine helpers
// ---------------------------------------------------------------------------

// XSS-veilige element-bouwer: kinderen worden via append() toegevoegd,
// strings worden dus altijd tekstnodes.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "hidden") node.hidden = true;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function formatDateNL(iso) {
  return `${L.formatBirthday(iso.slice(5))} ${iso.slice(0, 4)}`;
}

let toastTimer = null;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 4000);
}

// Generieke bevestigingsdialoog; resolvet naar true/false.
function confirmDialog(body, { okLabel = "OK", okOnly = false } = {}) {
  const dialog = $("#confirm-dialog");
  const container = $("#confirm-body");
  container.replaceChildren(body);
  $("#confirm-ok").textContent = okLabel;
  $("#confirm-cancel").hidden = okOnly;
  dialog.returnValue = "cancel"; // Esc sluit zonder returnValue te zetten
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
  });
}

function persist() {
  if (DEMO) return; // demo-modus raakt de opslag niet aan
  if (!storage.save(state)) {
    toast("Opslaan mislukt (opslag vol?). Exporteer je gegevens als back-up.");
  }
}

function setState(next) {
  state = next;
  persist();
  render();
}

// ---------------------------------------------------------------------------
// Demo-data (?demo=1) — alleen in geheugen, o.a. voor screenshots
// ---------------------------------------------------------------------------

function demoState() {
  const today = L.todayISO();
  const make = (fields, daysAgo, extra = {}) => {
    const lastContact = daysAgo == null ? null : L.addDays(today, -daysAgo);
    const person = { ...L.newPerson({ ...fields, lastContact }, today), ...extra };
    if (lastContact) person.contactHistory = [{ date: lastContact, note: extra.note ?? "" }, ...(extra.contactHistory ?? [])];
    delete person.note;
    return person;
  };
  return {
    schemaVersion: 1,
    persons: [
      make({ name: "Sarah K.", relationship: "close-friend", frequency: "monthly" }, 247, { note: "verjaardagsfeest" }),
      make({ name: "Oom David", relationship: "family", frequency: "quarterly" }, 134),
      make({ name: "Joris de Wit", relationship: "colleague", frequency: "monthly" }, null),
      make({ name: "Marcus W.", relationship: "mentor", frequency: "monthly" }, 23, { note: "koffie in de stad" }),
      make({ name: "Mama", relationship: "family", frequency: "weekly" }, 3, {
        birthday: L.addDays(today, 11).slice(5),
        notes: "Elke zondag bellen.",
        contactHistory: [{ date: L.addDays(today, -10), note: "zondagse belafspraak" }],
      }),
      make({ name: "Anouk", relationship: "friend", frequency: "monthly" }, 10),
    ],
  };
}

// ---------------------------------------------------------------------------
// Renderen
// ---------------------------------------------------------------------------

const BADGE_LABELS = { overdue: "Achterstallig", "due-soon": "Binnenkort", ok: "Op schema", never: "Nieuw" };

function statusLine(status) {
  switch (status.status) {
    case "overdue":
      return L.formatOverdue(status.daysOverdue);
    case "due-soon":
      return L.formatDue(status.daysUntilDue);
    case "never":
      return "plan een eerste contactmoment";
    default:
      return "op schema";
  }
}

function renderCard(person, today) {
  const status = L.computeStatus(person, today);
  const freqLabel = L.FREQUENCIES[person.frequency].label;
  const isExpanded = expanded.has(person.id);

  const title = el("div", { class: "card-title" }, el("span", { class: "name" }, person.name));
  const next = L.nextBirthday(person.birthday, today);
  if (next && next.daysUntil <= 30) {
    const when = next.daysUntil === 0 ? "vandaag!" : `over ${next.daysUntil} ${next.daysUntil === 1 ? "dag" : "dagen"}`;
    title.append(el("span", { class: "birthday-inline", title: `Jarig ${when}` }, `🎂 ${L.formatBirthday(person.birthday)}`));
  }
  title.append(el("span", { class: "relationship" }, L.RELATIONSHIPS[person.relationship]));

  const meta =
    person.lastContact == null
      ? `Nog geen contactmoment · ${freqLabel}`
      : `Laatst gesproken: ${L.formatAgo(status.daysSinceContact)} · ${freqLabel}`;

  const actions = el("div", { class: "card-actions" });
  if (status.status !== "ok") {
    actions.append(el("button", { class: "btn small", type: "button", "data-action": "contacted" }, "✓ Vandaag gesproken"));
  }
  actions.append(el("button", { class: "btn small", type: "button", "data-action": "edit" }, "Bewerken"));

  const details = el("div", { class: "card-details", hidden: !isExpanded });
  if (isExpanded) {
    const notesArea = el("textarea", { class: "notes", rows: "3", placeholder: "Notities…" });
    notesArea.value = person.notes;
    details.append(el("label", {}, "Notities", notesArea));

    const historyList = el("ul", { class: "history-list" });
    person.contactHistory.forEach((entry, index) => {
      historyList.append(
        el(
          "li",
          {},
          el("span", { class: "history-date" }, formatDateNL(entry.date)),
          el("span", { class: "history-note" }, entry.note),
          el("button", { class: "del-history", type: "button", "data-action": "del-history", "data-index": String(index), title: "Contactmoment verwijderen" }, "✕")
        )
      );
    });
    const history = el("div", { class: "history" }, el("h4", {}, "Contactgeschiedenis"));
    history.append(person.contactHistory.length ? historyList : el("p", { class: "history-empty" }, "Nog geen contactmomenten."));
    details.append(history);
  }

  return el(
    "li",
    { class: `card status-${status.status}`, "data-id": person.id },
    el(
      "div",
      { class: "card-main" },
      el("span", { class: "avatar", "aria-hidden": "true" }, L.initials(person.name)),
      el("div", { class: "card-info" }, title, el("div", { class: "card-meta" }, meta), el("div", { class: "card-status-line" }, statusLine(status))),
      el("span", { class: `badge ${status.status}` }, BADGE_LABELS[status.status]),
      el(
        "button",
        { class: "btn icon expand-btn", type: "button", "data-action": "toggle-details", "aria-expanded": String(isExpanded), title: "Details" },
        "▾"
      )
    ),
    actions,
    details
  );
}

function render() {
  const today = L.todayISO();
  const stats = L.computeStats(state.persons, today);

  $("#stat-tracking").textContent = String(stats.tracking);
  $("#stat-overdue").textContent = String(stats.overdue);
  $("#stat-duesoon").textContent = String(stats.dueSoon);
  $("#stat-birthday").textContent = stats.nextBirthday
    ? `${stats.nextBirthday.person.name} · ${stats.nextBirthday.daysUntil === 0 ? "vandaag 🎉" : `${stats.nextBirthday.daysUntil}d`}`
    : "—";

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.status === filter.status);
  });

  const visible = L.sortByUrgency(L.filterPersons(state.persons, filter, today), today);
  const list = $("#person-list");
  list.replaceChildren(...visible.map((p) => renderCard(p, today)));

  $("#empty-state").hidden = state.persons.length > 0;
  $("#no-results").hidden = state.persons.length === 0 || visible.length > 0;
}

// ---------------------------------------------------------------------------
// Persoonsdialoog
// ---------------------------------------------------------------------------

const MONTHS_FULL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function fillFormSelects() {
  $("#f-relationship").replaceChildren(
    ...Object.entries(L.RELATIONSHIPS).map(([value, label]) => el("option", { value }, label))
  );
  $("#f-frequency").replaceChildren(
    ...Object.entries(L.FREQUENCIES).map(([value, { label }]) => el("option", { value }, label))
  );
  $("#f-bday-day").replaceChildren(
    el("option", { value: "" }, "— dag"),
    ...Array.from({ length: 31 }, (_, i) => el("option", { value: String(i + 1).padStart(2, "0") }, String(i + 1)))
  );
  $("#f-bday-month").replaceChildren(
    el("option", { value: "" }, "— maand"),
    ...MONTHS_FULL.map((label, i) => el("option", { value: String(i + 1).padStart(2, "0") }, label))
  );
}

function openDialog(person = null) {
  editingId = person?.id ?? null;
  $("#dialog-title").textContent = person ? "Persoon bewerken" : "Persoon toevoegen";
  $("#form-error").hidden = true;
  $("#delete-btn").hidden = !person;
  $("#f-name").value = person?.name ?? "";
  $("#f-relationship").value = person?.relationship ?? "other";
  $("#f-frequency").value = person?.frequency ?? "monthly";
  $("#f-lastcontact").value = person?.lastContact ?? "";
  $("#f-lastcontact").max = L.todayISO();
  $("#f-bday-day").value = person?.birthday ? person.birthday.slice(3) : "";
  $("#f-bday-month").value = person?.birthday ? person.birthday.slice(0, 2) : "";
  $("#f-notes").value = person?.notes ?? "";
  $("#person-dialog").showModal();
  $("#f-name").focus();
}

function showFormError(message) {
  const node = $("#form-error");
  node.textContent = message;
  node.hidden = false;
}

function handleFormSubmit(event) {
  event.preventDefault();
  const day = $("#f-bday-day").value;
  const month = $("#f-bday-month").value;
  if ((day && !month) || (!day && month)) {
    showFormError("Kies zowel een dag als een maand voor de verjaardag.");
    return;
  }

  const fields = {
    name: $("#f-name").value,
    relationship: $("#f-relationship").value,
    frequency: $("#f-frequency").value,
    lastContact: $("#f-lastcontact").value || null,
    birthday: day && month ? `${month}-${day}` : null,
    notes: $("#f-notes").value,
  };

  const today = L.todayISO();
  let validated;
  try {
    validated = L.newPerson(fields, today);
  } catch (err) {
    showFormError(err.message);
    return;
  }

  if (editingId !== null) {
    const existing = state.persons.find((p) => p.id === editingId);
    if (existing) {
      validated = { ...validated, id: existing.id, createdAt: existing.createdAt, contactHistory: existing.contactHistory };
    }
  }

  setState(L.upsertPerson(state, validated));
  $("#person-dialog").close();
  toast(editingId ? "Wijzigingen opgeslagen." : `${validated.name} toegevoegd.`);
}

async function handleDelete() {
  const person = state.persons.find((p) => p.id === editingId);
  if (!person) return;
  const ok = await confirmDialog(
    el("p", {}, `${person.name} verwijderen? De contactgeschiedenis gaat dan ook verloren.`),
    { okLabel: "Verwijderen" }
  );
  if (!ok) return;
  expanded.delete(person.id);
  setState(L.removePerson(state, person.id));
  $("#person-dialog").close();
  toast(`${person.name} verwijderd.`);
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

function handleExport() {
  const blob = new Blob([L.serialize(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: `stay-in-touch-backup-${L.todayISO()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Back-up gedownload.");
}

async function handleImportFile(file) {
  const text = await file.text();
  const result = L.validateImport(text);

  if (!result.ok) {
    const shown = result.errors.slice(0, 8);
    const body = el(
      "div",
      {},
      el("p", {}, "Dit bestand kan niet worden geïmporteerd:"),
      el("ul", {}, ...shown.map((e) => el("li", {}, e)), ...(result.errors.length > 8 ? [el("li", {}, "…")] : []))
    );
    await confirmDialog(body, { okOnly: true });
    return;
  }

  const count = result.state.persons.length;
  const ok = await confirmDialog(
    el("p", {}, `Huidige gegevens vervangen door back-up met ${count} ${count === 1 ? "persoon" : "personen"}?`),
    { okLabel: "Vervangen" }
  );
  if (!ok) return;

  expanded.clear();
  setState(result.state);
  toast("Back-up geïmporteerd.");
}

// ---------------------------------------------------------------------------
// Thema
// ---------------------------------------------------------------------------

const THEME_ICONS = { system: "🌗", light: "☀️", dark: "🌙" };
const THEME_LABELS = { system: "systeem", light: "licht", dark: "donker" };

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const button = $("#theme-toggle");
  button.textContent = THEME_ICONS[theme ?? "system"];
  button.title = `Thema: ${THEME_LABELS[theme ?? "system"]} (klik om te wisselen)`;
}

function cycleTheme() {
  const order = [null, "light", "dark"];
  const current = document.documentElement.dataset.theme ?? null;
  const next = order[(order.indexOf(current) + 1) % order.length];
  if (!DEMO) storage.saveTheme(next);
  applyTheme(next);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function wireEvents() {
  $("#add-btn").addEventListener("click", () => openDialog());
  $("#empty-add-btn").addEventListener("click", () => openDialog());
  $("#person-form").addEventListener("submit", handleFormSubmit);
  $("#cancel-btn").addEventListener("click", () => $("#person-dialog").close());
  $("#delete-btn").addEventListener("click", handleDelete);

  $("#confirm-ok").addEventListener("click", () => $("#confirm-dialog").close("ok"));
  $("#confirm-cancel").addEventListener("click", () => $("#confirm-dialog").close("cancel"));

  $("#export-btn").addEventListener("click", handleExport);
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = ""; // zelfde bestand opnieuw kiezen blijft mogelijk
    if (file) handleImportFile(file);
  });

  $("#theme-toggle").addEventListener("click", cycleTheme);

  $("#search").addEventListener("input", (event) => {
    filter = { ...filter, query: event.target.value };
    render();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = { ...filter, status: chip.dataset.status };
      render();
    });
  });

  const list = $("#person-list");
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.closest(".card")?.dataset.id;
    if (!id) return;
    const person = state.persons.find((p) => p.id === id);
    if (!person) return;

    switch (button.dataset.action) {
      case "contacted":
        setState(L.markContacted(state, id, L.todayISO()));
        toast(`Contact met ${person.name} genoteerd. 👍`);
        break;
      case "edit":
        openDialog(person);
        break;
      case "toggle-details":
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        render();
        break;
      case "del-history": {
        const index = Number(button.dataset.index);
        confirmDialog(el("p", {}, "Dit contactmoment verwijderen?"), { okLabel: "Verwijderen" }).then((ok) => {
          if (ok) setState(L.removeContactEntry(state, id, index));
        });
        break;
      }
    }
  });

  // Notities opslaan zodra het veld focus verliest (geen re-render nodig).
  list.addEventListener("focusout", (event) => {
    if (!event.target.matches("textarea.notes")) return;
    const id = event.target.closest(".card")?.dataset.id;
    const person = state.persons.find((p) => p.id === id);
    if (!person || person.notes === event.target.value) return;
    state = L.upsertPerson(state, { ...person, notes: event.target.value });
    persist();
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

$("#storage-banner").hidden = DEMO || persistent;
$("#demo-banner").hidden = !DEMO;
applyTheme(document.documentElement.dataset.theme ?? null);
fillFormSelects();
wireEvents();
render();
