// Pure logica voor de Stay-in-Touch Tracker.
// Geen DOM, geen localStorage, geen klok: "vandaag" is altijd een parameter.
// Alle datums zijn date-only strings ("YYYY-MM-DD"); rekenwerk gaat via
// Date.UTC zodat zomertijd (DST) nooit voor afrondingsfouten kan zorgen.

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

export function parseISODate(str) {
  if (typeof str !== "string") return null;
  const match = ISO_DATE_RE.exec(str);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidISODate(str) {
  return parseISODate(str) !== null;
}

function toUTC(dateStr) {
  const parts = parseISODate(dateStr);
  if (!parts) throw new TypeError(`Ongeldige datum: ${dateStr}`);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function fromUTC(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diffDays(aStr, bStr) {
  return Math.round((toUTC(bStr) - toUTC(aStr)) / MS_PER_DAY);
}

export function addDays(dateStr, n) {
  return fromUTC(toUTC(dateStr) + n * MS_PER_DAY);
}

export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// Domeinconstanten
// ---------------------------------------------------------------------------

export const FREQUENCIES = {
  weekly: { intervalDays: 7, dueSoonDays: 2, label: "Wekelijks" },
  monthly: { intervalDays: 30, dueSoonDays: 7, label: "Maandelijks" },
  quarterly: { intervalDays: 91, dueSoonDays: 14, label: "Per kwartaal" },
};

export const RELATIONSHIPS = {
  family: "Familie",
  "close-friend": "Goede vriend(in)",
  friend: "Vriend(in)",
  mentor: "Mentor",
  colleague: "Collega",
  other: "Overig",
};

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

// Bepaalt de check-in status van een persoon op basis van frequentie en
// laatste contactdatum. Een lastContact in de toekomst (mogelijk via import)
// wordt op vandaag geklemd.
export function computeStatus(person, todayStr) {
  const freq = FREQUENCIES[person.frequency];
  if (!freq) throw new TypeError(`Onbekende frequentie: ${person.frequency}`);

  if (person.lastContact == null) {
    return { status: "never", dueDate: null, daysOverdue: 0, daysUntilDue: 0, daysSinceContact: null };
  }

  const lastContact = diffDays(todayStr, person.lastContact) > 0 ? todayStr : person.lastContact;
  const dueDate = addDays(lastContact, freq.intervalDays);
  const daysSinceContact = diffDays(lastContact, todayStr);
  const untilDue = diffDays(todayStr, dueDate); // negatief = over tijd

  let status;
  if (untilDue < 0) status = "overdue";
  else if (untilDue <= freq.dueSoonDays) status = "due-soon";
  else status = "ok";

  return {
    status,
    dueDate,
    daysOverdue: Math.max(0, -untilDue),
    daysUntilDue: Math.max(0, untilDue),
    daysSinceContact,
  };
}

// ---------------------------------------------------------------------------
// Nederlandse formattering
// ---------------------------------------------------------------------------

// Gedeelde banden: dagen (<14), weken (14–59, floor/7), maanden (>=60, round/30.44)
function elapsedUnits(days) {
  if (days < 14) return { n: days, unit: days === 1 ? "dag" : "dagen" };
  if (days < 60) return { n: Math.floor(days / 7), unit: "weken" };
  return { n: Math.round(days / 30.44), unit: "maanden" };
}

export function formatOverdue(days) {
  const { n, unit } = elapsedUnits(days);
  return `${n} ${unit} achterstallig`;
}

export function formatDue(daysUntil) {
  if (daysUntil === 0) return "vandaag contact opnemen";
  if (daysUntil === 1) return "morgen";
  return `over ${daysUntil} dagen`;
}

export function formatAgo(days) {
  if (days === 0) return "vandaag";
  if (days === 1) return "gisteren";
  const { n, unit } = elapsedUnits(days);
  return `${n} ${unit} geleden`;
}

const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function formatBirthday(mmdd) {
  const [mm, dd] = mmdd.split("-").map(Number);
  return `${dd} ${MONTHS_NL[mm - 1]}`;
}

export function initials(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Verjaardagen
// ---------------------------------------------------------------------------

// Volgende verjaardag vanaf vandaag (inclusief vandaag zelf).
// 29 februari wordt in niet-schrikkeljaren op 28 februari gevierd.
export function nextBirthday(mmdd, todayStr) {
  if (mmdd == null) return null;
  const [mm, dd] = String(mmdd).split("-").map(Number);
  const today = parseISODate(todayStr);
  if (!today) throw new TypeError(`Ongeldige datum: ${todayStr}`);

  const pad = (n) => String(n).padStart(2, "0");
  const observed = (year) => {
    const day = mm === 2 && dd === 29 && !isLeapYear(year) ? 28 : dd;
    return `${year}-${pad(mm)}-${pad(day)}`;
  };

  let candidate = observed(today.year);
  if (diffDays(todayStr, candidate) < 0) candidate = observed(today.year + 1);
  return { date: candidate, daysUntil: diffDays(todayStr, candidate) };
}

export function nextBirthdayOverall(persons, todayStr) {
  let best = null;
  for (const p of persons) {
    const next = nextBirthday(p.birthday, todayStr);
    if (!next) continue;
    if (
      best === null ||
      next.daysUntil < best.daysUntil ||
      (next.daysUntil === best.daysUntil && p.name.localeCompare(best.person.name, "nl") < 0)
    ) {
      best = { person: p, daysUntil: next.daysUntil };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Sorteren, filteren, statistieken
// ---------------------------------------------------------------------------

const STATUS_RANK = { overdue: 0, never: 1, "due-soon": 2, ok: 3 };

// Meest urgente eerst: achterstallig (meeste dagen eerst), dan nog-nooit,
// dan binnenkort (dichtstbij eerst), dan op schema. Gelijkspel op naam.
export function sortByUrgency(persons, todayStr) {
  return persons
    .map((p) => ({ p, s: computeStatus(p, todayStr) }))
    .sort((a, b) => {
      const byRank = STATUS_RANK[a.s.status] - STATUS_RANK[b.s.status];
      if (byRank !== 0) return byRank;
      if (a.s.status === "overdue" && a.s.daysOverdue !== b.s.daysOverdue) {
        return b.s.daysOverdue - a.s.daysOverdue;
      }
      if (a.s.daysUntilDue !== b.s.daysUntilDue) return a.s.daysUntilDue - b.s.daysUntilDue;
      return a.p.name.localeCompare(b.p.name, "nl");
    })
    .map((x) => x.p);
}

// status: "all" | "overdue" | "due-soon" | "ok" — "never" telt als due-soon.
export function filterPersons(persons, { query = "", status = "all" } = {}, todayStr) {
  const q = String(query).trim().toLowerCase();
  return persons.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (status === "all") return true;
    const s = computeStatus(p, todayStr).status;
    return (s === "never" ? "due-soon" : s) === status;
  });
}

export function computeStats(persons, todayStr) {
  let overdue = 0;
  let dueSoon = 0;
  for (const p of persons) {
    const s = computeStatus(p, todayStr).status;
    if (s === "overdue") overdue += 1;
    else if (s === "due-soon" || s === "never") dueSoon += 1;
  }
  return {
    tracking: persons.length,
    overdue,
    dueSoon,
    nextBirthday: nextBirthdayOverall(persons, todayStr),
  };
}

// ---------------------------------------------------------------------------
// State & mutaties (puur: input wordt nooit gemuteerd)
// ---------------------------------------------------------------------------

export function emptyState() {
  return { schemaVersion: 1, persons: [] };
}

const BIRTHDAY_RE = /^(\d{2})-(\d{2})$/;

// "MM-DD"; 29 feb is toegestaan (schrikkeljaar-referentie).
function isValidBirthday(mmdd) {
  if (typeof mmdd !== "string") return false;
  const match = BIRTHDAY_RE.exec(mmdd);
  if (!match) return false;
  const mm = Number(match[1]);
  const dd = Number(match[2]);
  if (mm < 1 || mm > 12) return false;
  return dd >= 1 && dd <= daysInMonth(2024, mm);
}

export function newPerson(fields = {}, todayStr) {
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name) throw new TypeError("Naam is verplicht.");

  const relationship = fields.relationship ?? "other";
  if (!(relationship in RELATIONSHIPS)) throw new TypeError(`Onbekende relatie: ${relationship}`);

  const frequency = fields.frequency ?? "monthly";
  if (!(frequency in FREQUENCIES)) throw new TypeError(`Onbekende frequentie: ${frequency}`);

  const lastContact = fields.lastContact ?? null;
  if (lastContact !== null && !isValidISODate(lastContact)) {
    throw new TypeError(`Ongeldige datum: ${lastContact}`);
  }

  const birthday = fields.birthday ?? null;
  if (birthday !== null && !isValidBirthday(birthday)) {
    throw new TypeError(`Ongeldige verjaardag: ${birthday}`);
  }

  return {
    id: crypto.randomUUID(),
    name,
    relationship,
    frequency,
    lastContact,
    birthday,
    notes: typeof fields.notes === "string" ? fields.notes : "",
    contactHistory: [],
    createdAt: todayStr,
  };
}

export function upsertPerson(state, person) {
  const exists = state.persons.some((p) => p.id === person.id);
  const persons = exists
    ? state.persons.map((p) => (p.id === person.id ? person : p))
    : [...state.persons, person];
  return { ...state, persons };
}

export function removePerson(state, id) {
  return { ...state, persons: state.persons.filter((p) => p.id !== id) };
}

export function markContacted(state, id, todayStr, note = "") {
  return {
    ...state,
    persons: state.persons.map((p) => {
      if (p.id !== id) return p;
      // Zelfde dag nogmaals klikken levert geen dubbele geschiedenis op.
      if (p.contactHistory[0]?.date === todayStr) return { ...p, lastContact: todayStr };
      return { ...p, lastContact: todayStr, contactHistory: [{ date: todayStr, note }, ...p.contactHistory] };
    }),
  };
}

// Verwijdert één geschiedenis-item; lastContact volgt het nieuwste overgebleven
// item (of wordt null als er niets meer over is).
export function removeContactEntry(state, id, index) {
  return {
    ...state,
    persons: state.persons.map((p) => {
      if (p.id !== id) return p;
      if (!Number.isInteger(index) || index < 0 || index >= p.contactHistory.length) return p;
      const contactHistory = p.contactHistory.filter((_, i) => i !== index);
      return { ...p, contactHistory, lastContact: contactHistory[0]?.date ?? null };
    }),
  };
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

export function serialize(state) {
  return JSON.stringify(state, null, 2);
}

// Schakelt op schemaVersion; toekomstige versies krijgen hier een upgrade-stap.
export function migrate(rawState) {
  if (typeof rawState !== "object" || rawState === null || Array.isArray(rawState)) return null;
  if (rawState.schemaVersion === 1) return rawState;
  return null;
}

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .filter((e) => typeof e === "object" && e !== null && isValidISODate(e.date))
    .map((e) => ({ date: e.date, note: typeof e.note === "string" ? e.note : "" }));
}

export function validateImport(jsonString) {
  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, errors: ["Bestand is geen geldige JSON."] };
  }

  const migrated = migrate(raw);
  if (!migrated) {
    return { ok: false, errors: ["Onbekende of niet-ondersteunde schemaversie."] };
  }
  if (!Array.isArray(migrated.persons)) {
    return { ok: false, errors: ["'persons' ontbreekt of is geen lijst."] };
  }

  const errors = [];
  const persons = [];
  const seenIds = new Set();

  migrated.persons.forEach((p, i) => {
    const label = `Persoon ${i + 1}`;
    if (typeof p !== "object" || p === null) {
      errors.push(`${label}: is geen object.`);
      return;
    }

    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name) errors.push(`${label}: naam ontbreekt of is leeg.`);

    const id = typeof p.id === "string" && p.id.length > 0 ? p.id : crypto.randomUUID();
    if (seenIds.has(id)) errors.push(`${label} ('${name}'): dubbele id '${id}'.`);
    seenIds.add(id);

    const relationship = p.relationship ?? "other";
    if (!(relationship in RELATIONSHIPS)) errors.push(`${label} ('${name}'): onbekende relatie '${p.relationship}'.`);

    const frequency = p.frequency ?? "monthly";
    if (!(frequency in FREQUENCIES)) errors.push(`${label} ('${name}'): onbekende frequentie '${p.frequency}'.`);

    const lastContact = p.lastContact ?? null;
    if (lastContact !== null && !isValidISODate(lastContact)) {
      errors.push(`${label} ('${name}'): ongeldige datum laatste contact '${p.lastContact}'.`);
    }

    const birthday = p.birthday ?? null;
    if (birthday !== null && !isValidBirthday(birthday)) {
      errors.push(`${label} ('${name}'): ongeldige verjaardag '${p.birthday}'.`);
    }

    persons.push({
      id,
      name,
      relationship,
      frequency,
      lastContact,
      birthday,
      notes: typeof p.notes === "string" ? p.notes : "",
      contactHistory: sanitizeHistory(p.contactHistory),
      createdAt: isValidISODate(p.createdAt) ? p.createdAt : null,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, state: { schemaVersion: 1, persons } };
}
