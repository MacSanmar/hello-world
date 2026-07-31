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
