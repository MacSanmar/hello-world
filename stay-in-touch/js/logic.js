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
