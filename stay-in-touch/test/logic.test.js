import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseISODate,
  isValidISODate,
  diffDays,
  addDays,
  todayISO,
  FREQUENCIES,
  RELATIONSHIPS,
  computeStatus,
  formatOverdue,
  formatDue,
  formatAgo,
  formatBirthday,
  initials,
  nextBirthday,
  nextBirthdayOverall,
  sortByUrgency,
  filterPersons,
  computeStats,
  emptyState,
  newPerson,
  upsertPerson,
  removePerson,
  markContacted,
  removeContactEntry,
  withLastContact,
  normalizeState,
  migrate,
  serialize,
  validateImport,
} from "../js/logic.js";

const TODAY = "2026-07-31";

function person(overrides = {}) {
  return {
    id: "p1",
    name: "Test Persoon",
    relationship: "friend",
    frequency: "monthly",
    lastContact: null,
    birthday: null,
    notes: "",
    contactHistory: [],
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("parseISODate", () => {
  it("parses a valid date", () => {
    assert.deepEqual(parseISODate("2026-07-31"), { year: 2026, month: 7, day: 31 });
  });

  it("rejects non-existent calendar dates", () => {
    assert.equal(parseISODate("2026-02-30"), null);
    assert.equal(parseISODate("2026-04-31"), null);
    assert.equal(parseISODate("2026-13-01"), null);
    assert.equal(parseISODate("2026-00-10"), null);
    assert.equal(parseISODate("2026-01-00"), null);
  });

  it("accepts 29 Feb only in leap years", () => {
    assert.deepEqual(parseISODate("2024-02-29"), { year: 2024, month: 2, day: 29 });
    assert.equal(parseISODate("2025-02-29"), null);
    assert.equal(parseISODate("2000-02-29") !== null, true); // divisible by 400 → leap
    assert.equal(parseISODate("1900-02-29"), null); // divisible by 100, not 400 → no leap
  });

  it("rejects garbage and wrong formats", () => {
    assert.equal(parseISODate("31-07-2026"), null);
    assert.equal(parseISODate("2026/07/31"), null);
    assert.equal(parseISODate("2026-7-31"), null);
    assert.equal(parseISODate(""), null);
    assert.equal(parseISODate(null), null);
    assert.equal(parseISODate(undefined), null);
    assert.equal(parseISODate(20260731), null);
    assert.equal(parseISODate("2026-07-31T12:00:00Z"), null);
  });
});

describe("isValidISODate", () => {
  it("mirrors parseISODate as a boolean", () => {
    assert.equal(isValidISODate("2026-07-31"), true);
    assert.equal(isValidISODate("2026-02-30"), false);
  });
});

describe("diffDays", () => {
  it("computes b - a in whole days", () => {
    assert.equal(diffDays("2026-07-01", "2026-07-31"), 30);
    assert.equal(diffDays("2026-07-31", "2026-07-01"), -30);
    assert.equal(diffDays("2026-07-31", "2026-07-31"), 0);
  });

  it("is exact across the March DST transition", () => {
    // 2026-03-29 is the EU DST switch; UTC-based math must still give exact integers
    assert.equal(diffDays("2026-03-28", "2026-03-30"), 2);
    assert.equal(diffDays("2026-03-01", "2026-04-01"), 31);
  });

  it("crosses year boundaries", () => {
    assert.equal(diffDays("2025-12-31", "2026-01-01"), 1);
    assert.equal(diffDays("2025-07-31", "2026-07-31"), 365);
    assert.equal(diffDays("2023-07-31", "2024-07-31"), 366); // 2024 is a leap year
  });
});

describe("addDays", () => {
  it("adds and subtracts days with month/year rollover", () => {
    assert.equal(addDays("2026-07-31", 1), "2026-08-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
    assert.equal(addDays("2026-07-31", 0), "2026-07-31");
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2025-02-28", 1), "2025-03-01");
  });

  it("pads with leading zeros", () => {
    assert.equal(addDays("2026-09-30", 1), "2026-10-01");
    assert.equal(addDays("2026-11-08", 1), "2026-11-09");
  });
});

describe("todayISO", () => {
  it("formats the local calendar date of the given Date", () => {
    // Construct via local-time constructor so the expectation is timezone-proof
    assert.equal(todayISO(new Date(2026, 6, 31, 23, 59)), "2026-07-31");
    assert.equal(todayISO(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
  });
});

describe("FREQUENCIES / RELATIONSHIPS", () => {
  it("defines Dutch labels and intervals", () => {
    assert.equal(FREQUENCIES.weekly.intervalDays, 7);
    assert.equal(FREQUENCIES.weekly.dueSoonDays, 2);
    assert.equal(FREQUENCIES.monthly.intervalDays, 30);
    assert.equal(FREQUENCIES.monthly.dueSoonDays, 7);
    assert.equal(FREQUENCIES.monthly.label, "Maandelijks");
    assert.equal(FREQUENCIES.quarterly.intervalDays, 91);
    assert.equal(FREQUENCIES.quarterly.dueSoonDays, 14);
    assert.equal(RELATIONSHIPS.family, "Familie");
    assert.equal(RELATIONSHIPS["close-friend"], "Goede vriend(in)");
  });
});

describe("computeStatus", () => {
  it("returns 'never' when there is no lastContact", () => {
    const s = computeStatus(person({ lastContact: null }), TODAY);
    assert.equal(s.status, "never");
    assert.equal(s.dueDate, null);
    assert.equal(s.daysSinceContact, null);
  });

  it("is 'ok' when the due date is beyond the due-soon window", () => {
    // monthly: contacted 20 days ago -> due in 10 days (window is 7)
    const s = computeStatus(person({ lastContact: "2026-07-11" }), TODAY);
    assert.equal(s.status, "ok");
    assert.equal(s.dueDate, "2026-08-10");
    assert.equal(s.daysUntilDue, 10);
    assert.equal(s.daysSinceContact, 20);
  });

  it("is 'due-soon' exactly at the window boundary", () => {
    // monthly: contacted 23 days ago -> due in 7 days (== dueSoonDays)
    const s = computeStatus(person({ lastContact: "2026-07-08" }), TODAY);
    assert.equal(s.status, "due-soon");
    assert.equal(s.daysUntilDue, 7);
  });

  it("is 'due-soon' (not overdue) on the due date itself", () => {
    const s = computeStatus(person({ lastContact: "2026-07-01" }), TODAY);
    assert.equal(s.status, "due-soon");
    assert.equal(s.daysUntilDue, 0);
  });

  it("is 'overdue' one day past the due date", () => {
    const s = computeStatus(person({ lastContact: "2026-06-30" }), TODAY);
    assert.equal(s.status, "overdue");
    assert.equal(s.daysOverdue, 1);
  });

  it("matches the mockup: 247 days ago, monthly", () => {
    const lastContact = addDays(TODAY, -247);
    const s = computeStatus(person({ lastContact }), TODAY);
    assert.equal(s.status, "overdue");
    assert.equal(s.daysSinceContact, 247);
    assert.equal(s.daysOverdue, 217);
  });

  it("handles weekly windows", () => {
    assert.equal(computeStatus(person({ frequency: "weekly", lastContact: "2026-07-28" }), TODAY).status, "ok"); // due in 4
    assert.equal(computeStatus(person({ frequency: "weekly", lastContact: "2026-07-25" }), TODAY).status, "due-soon"); // due in 1
    assert.equal(computeStatus(person({ frequency: "weekly", lastContact: "2026-07-23" }), TODAY).status, "overdue"); // 1 over
  });

  it("handles quarterly (mockup: 134 days ago is overdue)", () => {
    const lastContact = addDays(TODAY, -134); // 2026-03-19
    const s = computeStatus(person({ frequency: "quarterly", lastContact }), TODAY);
    assert.equal(s.status, "overdue");
    assert.equal(s.daysOverdue, 43);
  });

  it("clamps a future lastContact to today", () => {
    const s = computeStatus(person({ lastContact: "2026-08-15" }), TODAY);
    assert.equal(s.status, "ok");
    assert.equal(s.daysSinceContact, 0);
    assert.equal(s.daysUntilDue, 30);
  });

  it("throws on an unknown frequency", () => {
    assert.throws(() => computeStatus(person({ frequency: "daily", lastContact: TODAY }), TODAY), TypeError);
  });
});

describe("formatOverdue", () => {
  it("uses days, weeks and months bands", () => {
    assert.equal(formatOverdue(1), "1 dag achterstallig");
    assert.equal(formatOverdue(2), "2 dagen achterstallig");
    assert.equal(formatOverdue(13), "13 dagen achterstallig");
    assert.equal(formatOverdue(14), "2 weken achterstallig");
    assert.equal(formatOverdue(59), "8 weken achterstallig");
    assert.equal(formatOverdue(60), "2 maanden achterstallig");
    assert.equal(formatOverdue(244), "8 maanden achterstallig");
  });
});

describe("formatDue", () => {
  it("formats 0, 1 and N days ahead", () => {
    assert.equal(formatDue(0), "vandaag contact opnemen");
    assert.equal(formatDue(1), "morgen");
    assert.equal(formatDue(8), "over 8 dagen");
  });
});

describe("formatAgo", () => {
  it("formats elapsed time in Dutch", () => {
    assert.equal(formatAgo(0), "vandaag");
    assert.equal(formatAgo(1), "gisteren");
    assert.equal(formatAgo(6), "6 dagen geleden");
    assert.equal(formatAgo(21), "3 weken geleden");
    assert.equal(formatAgo(247), "8 maanden geleden");
  });
});

describe("formatBirthday", () => {
  it("renders MM-DD as Dutch short date", () => {
    assert.equal(formatBirthday("06-18"), "18 jun");
    assert.equal(formatBirthday("01-01"), "1 jan");
    assert.equal(formatBirthday("02-29"), "29 feb");
    assert.equal(formatBirthday("12-05"), "5 dec");
  });
});

describe("initials", () => {
  it("derives up to two initials", () => {
    assert.equal(initials("Sander Martens"), "SM");
    assert.equal(initials("Mama"), "MA");
    assert.equal(initials("sarah k."), "SK");
    assert.equal(initials("  oom   david  "), "OD");
    assert.equal(initials("X"), "X");
    assert.equal(initials("Jan van Dijk"), "JV");
  });
});

describe("nextBirthday", () => {
  it("returns this year's date when still ahead", () => {
    assert.deepEqual(nextBirthday("08-11", TODAY), { date: "2026-08-11", daysUntil: 11 });
  });

  it("returns today with 0 days on the birthday itself", () => {
    assert.deepEqual(nextBirthday("07-31", TODAY), { date: "2026-07-31", daysUntil: 0 });
  });

  it("rolls over to next year when already passed", () => {
    assert.deepEqual(nextBirthday("06-18", TODAY), { date: "2027-06-18", daysUntil: 322 });
  });

  it("crosses the new-year boundary", () => {
    assert.deepEqual(nextBirthday("01-01", "2026-12-31"), { date: "2027-01-01", daysUntil: 1 });
  });

  it("observes 29 Feb on 28 Feb in non-leap years", () => {
    assert.deepEqual(nextBirthday("02-29", "2026-01-15"), { date: "2026-02-28", daysUntil: 44 });
  });

  it("uses the real 29 Feb in leap years", () => {
    assert.deepEqual(nextBirthday("02-29", "2028-02-01"), { date: "2028-02-29", daysUntil: 28 });
  });

  it("rolls a passed 29 Feb into the next year's observed date", () => {
    assert.deepEqual(nextBirthday("02-29", "2027-03-01"), { date: "2028-02-29", daysUntil: 365 });
  });

  it("returns null without a birthday", () => {
    assert.equal(nextBirthday(null, TODAY), null);
  });
});

describe("nextBirthdayOverall", () => {
  it("picks the person whose birthday comes first", () => {
    const mama = person({ id: "m", name: "Mama", birthday: "08-11" });
    const other = person({ id: "o", name: "Oom David", birthday: "10-02" });
    const none = person({ id: "n", name: "Niemand", birthday: null });
    const result = nextBirthdayOverall([none, other, mama], TODAY);
    assert.equal(result.person.name, "Mama");
    assert.equal(result.daysUntil, 11);
  });

  it("returns null when nobody has a birthday", () => {
    assert.equal(nextBirthdayOverall([person({ birthday: null })], TODAY), null);
    assert.equal(nextBirthdayOverall([], TODAY), null);
  });
});

describe("sortByUrgency", () => {
  // mockup cast, computed relative to TODAY
  const sarah = person({ id: "s", name: "Sarah K.", frequency: "monthly", lastContact: addDays(TODAY, -247) }); // 217d overdue
  const oomDavid = person({ id: "d", name: "Oom David", frequency: "quarterly", lastContact: addDays(TODAY, -134) }); // 43d overdue
  const nieuw = person({ id: "n", name: "Nieuw Persoon", lastContact: null }); // never
  const marcus = person({ id: "w", name: "Marcus W.", frequency: "monthly", lastContact: addDays(TODAY, -23) }); // due in 7
  const anna = person({ id: "a", name: "Anna", frequency: "weekly", lastContact: addDays(TODAY, -6) }); // due in 1
  const mama = person({ id: "m", name: "Mama", frequency: "monthly", lastContact: addDays(TODAY, -10) }); // ok, due in 20

  it("orders overdue desc, then never, then due-soon asc, then ok", () => {
    const sorted = sortByUrgency([mama, marcus, anna, nieuw, oomDavid, sarah], TODAY);
    assert.deepEqual(sorted.map((p) => p.id), ["s", "d", "n", "a", "w", "m"]);
  });

  it("breaks ties alphabetically (Dutch collation)", () => {
    const b = person({ id: "b", name: "Bram", lastContact: addDays(TODAY, -247) });
    const a = person({ id: "a2", name: "Anouk", lastContact: addDays(TODAY, -247) });
    const sorted = sortByUrgency([b, a], TODAY);
    assert.deepEqual(sorted.map((p) => p.name), ["Anouk", "Bram"]);
  });

  it("does not mutate the input array", () => {
    const input = [mama, sarah];
    sortByUrgency(input, TODAY);
    assert.deepEqual(input.map((p) => p.id), ["m", "s"]);
  });
});

describe("filterPersons", () => {
  const sarah = person({ id: "s", name: "Sarah K.", lastContact: addDays(TODAY, -247) }); // overdue
  const marcus = person({ id: "w", name: "Marcus W.", lastContact: addDays(TODAY, -23) }); // due-soon
  const nieuw = person({ id: "n", name: "Nieuw", lastContact: null }); // never
  const mama = person({ id: "m", name: "Mama", lastContact: addDays(TODAY, -10) }); // ok
  const all = [sarah, marcus, nieuw, mama];

  it("matches name substrings case-insensitively", () => {
    assert.deepEqual(filterPersons(all, { query: "AR" }, TODAY).map((p) => p.id), ["s", "w"]);
    assert.deepEqual(filterPersons(all, { query: "  mama " }, TODAY).map((p) => p.id), ["m"]);
  });

  it("filters by status, counting 'never' as due-soon", () => {
    assert.deepEqual(filterPersons(all, { status: "overdue" }, TODAY).map((p) => p.id), ["s"]);
    assert.deepEqual(filterPersons(all, { status: "due-soon" }, TODAY).map((p) => p.id), ["w", "n"]);
    assert.deepEqual(filterPersons(all, { status: "ok" }, TODAY).map((p) => p.id), ["m"]);
    assert.equal(filterPersons(all, { status: "all" }, TODAY).length, 4);
    assert.equal(filterPersons(all, {}, TODAY).length, 4);
  });

  it("combines query and status", () => {
    assert.deepEqual(filterPersons(all, { query: "a", status: "overdue" }, TODAY).map((p) => p.id), ["s"]);
  });
});

describe("computeStats", () => {
  it("counts tracking, overdue and due-soon (incl. never) and finds next birthday", () => {
    const persons = [
      person({ id: "s", name: "Sarah K.", lastContact: addDays(TODAY, -247) }), // overdue
      person({ id: "d", name: "Oom David", frequency: "quarterly", lastContact: addDays(TODAY, -134) }), // overdue
      person({ id: "w", name: "Marcus W.", lastContact: addDays(TODAY, -23) }), // due-soon
      person({ id: "n", name: "Nieuw", lastContact: null }), // never -> due-soon
      person({ id: "m", name: "Mama", lastContact: addDays(TODAY, -10), birthday: "08-11" }), // ok
    ];
    const stats = computeStats(persons, TODAY);
    assert.equal(stats.tracking, 5);
    assert.equal(stats.overdue, 2);
    assert.equal(stats.dueSoon, 2);
    assert.equal(stats.nextBirthday.person.name, "Mama");
    assert.equal(stats.nextBirthday.daysUntil, 11);
  });

  it("handles an empty list", () => {
    assert.deepEqual(computeStats([], TODAY), { tracking: 0, overdue: 0, dueSoon: 0, nextBirthday: null });
  });
});

describe("emptyState", () => {
  it("is a fresh v1 state", () => {
    assert.deepEqual(emptyState(), { schemaVersion: 1, persons: [] });
  });
});

describe("newPerson", () => {
  it("fills defaults, trims the name and stamps id/createdAt", () => {
    const p = newPerson({ name: "  Sarah K.  " }, TODAY);
    assert.equal(p.name, "Sarah K.");
    assert.equal(typeof p.id, "string");
    assert.ok(p.id.length > 0);
    assert.equal(p.createdAt, TODAY);
    assert.equal(p.relationship, "other");
    assert.equal(p.frequency, "monthly");
    assert.equal(p.lastContact, null);
    assert.equal(p.birthday, null);
    assert.equal(p.notes, "");
    assert.deepEqual(p.contactHistory, []);
  });

  it("generates unique ids", () => {
    assert.notEqual(newPerson({ name: "A" }, TODAY).id, newPerson({ name: "A" }, TODAY).id);
  });

  it("accepts valid optional fields", () => {
    const p = newPerson(
      { name: "Mama", relationship: "family", frequency: "weekly", lastContact: "2026-07-25", birthday: "02-29", notes: "lief" },
      TODAY
    );
    assert.equal(p.relationship, "family");
    assert.equal(p.birthday, "02-29");
    assert.equal(p.notes, "lief");
  });

  it("rejects invalid input with Dutch TypeErrors", () => {
    assert.throws(() => newPerson({ name: "" }, TODAY), /Naam/);
    assert.throws(() => newPerson({ name: "   " }, TODAY), /Naam/);
    assert.throws(() => newPerson({}, TODAY), /Naam/);
    assert.throws(() => newPerson({ name: "X", frequency: "daily" }, TODAY), /frequentie/i);
    assert.throws(() => newPerson({ name: "X", relationship: "vijand" }, TODAY), /relatie/i);
    assert.throws(() => newPerson({ name: "X", lastContact: "2026-02-30" }, TODAY), /datum/i);
    assert.throws(() => newPerson({ name: "X", birthday: "02-30" }, TODAY), /verjaardag/i);
    assert.throws(() => newPerson({ name: "X", birthday: "13-01" }, TODAY), /verjaardag/i);
  });
});

describe("upsertPerson / removePerson", () => {
  const a = person({ id: "a", name: "Anna" });
  const b = person({ id: "b", name: "Bram" });
  const state = { schemaVersion: 1, persons: [a, b] };

  it("appends a new person", () => {
    const c = person({ id: "c", name: "Cas" });
    const next = upsertPerson(state, c);
    assert.deepEqual(next.persons.map((p) => p.id), ["a", "b", "c"]);
    assert.deepEqual(state.persons.map((p) => p.id), ["a", "b"]); // input untouched
  });

  it("replaces an existing person by id", () => {
    const next = upsertPerson(state, { ...a, name: "Anouk" });
    assert.equal(next.persons[0].name, "Anouk");
    assert.equal(state.persons[0].name, "Anna");
  });

  it("removes by id and ignores unknown ids", () => {
    assert.deepEqual(removePerson(state, "a").persons.map((p) => p.id), ["b"]);
    assert.deepEqual(removePerson(state, "zzz").persons.map((p) => p.id), ["a", "b"]);
    assert.deepEqual(state.persons.map((p) => p.id), ["a", "b"]);
  });
});

describe("markContacted", () => {
  it("sets lastContact and prepends to contactHistory without mutating input", () => {
    const p = person({ id: "a", lastContact: "2026-07-01", contactHistory: [{ date: "2026-07-01", note: "" }] });
    const state = { schemaVersion: 1, persons: [p] };
    const next = markContacted(state, "a", TODAY, "koffie gedronken");
    assert.equal(next.persons[0].lastContact, TODAY);
    assert.deepEqual(next.persons[0].contactHistory[0], { date: TODAY, note: "koffie gedronken" });
    assert.equal(next.persons[0].contactHistory.length, 2);
    assert.equal(p.lastContact, "2026-07-01");
    assert.equal(p.contactHistory.length, 1);
  });

  it("defaults the note to empty and ignores unknown ids", () => {
    const p = person({ id: "a" });
    const state = { schemaVersion: 1, persons: [p] };
    assert.deepEqual(markContacted(state, "a", TODAY).persons[0].contactHistory, [{ date: TODAY, note: "" }]);
    assert.deepEqual(markContacted(state, "zzz", TODAY), state);
  });
});

describe("migrate", () => {
  it("passes v1 through and rejects anything else", () => {
    const state = { schemaVersion: 1, persons: [] };
    assert.deepEqual(migrate(state), state);
    assert.equal(migrate({ schemaVersion: 2, persons: [] }), null);
    assert.equal(migrate({}), null);
    assert.equal(migrate(null), null);
    assert.equal(migrate("nee"), null);
  });
});

describe("serialize / validateImport", () => {
  const state = {
    schemaVersion: 1,
    persons: [
      person({ id: "a", name: "Anna", lastContact: "2026-07-01", birthday: "06-18", contactHistory: [{ date: "2026-07-01", note: "hoi" }] }),
      person({ id: "b", name: "Bram" }),
    ],
  };

  it("round-trips", () => {
    const result = validateImport(serialize(state));
    assert.equal(result.ok, true);
    assert.deepEqual(result.state, state);
  });

  it("rejects malformed JSON and non-objects", () => {
    assert.equal(validateImport("dit is geen json").ok, false);
    assert.equal(validateImport("[]").ok, false);
    assert.equal(validateImport("42").ok, false);
  });

  it("rejects unsupported schema versions", () => {
    const result = validateImport(JSON.stringify({ schemaVersion: 99, persons: [] }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /versie/i);
  });

  it("rejects a missing persons array", () => {
    assert.equal(validateImport(JSON.stringify({ schemaVersion: 1 })).ok, false);
    assert.equal(validateImport(JSON.stringify({ schemaVersion: 1, persons: "nee" })).ok, false);
  });

  it("rejects persons with missing names, bad enums, bad dates or duplicate ids", () => {
    const bad = (p) => validateImport(JSON.stringify({ schemaVersion: 1, persons: [p] }));
    assert.equal(bad({ id: "x" }).ok, false);
    assert.equal(bad({ id: "x", name: "A", relationship: "vijand" }).ok, false);
    assert.equal(bad({ id: "x", name: "A", frequency: "daily" }).ok, false);
    assert.equal(bad({ id: "x", name: "A", lastContact: "2026-02-30" }).ok, false);
    assert.equal(bad({ id: "x", name: "A", birthday: "02-30" }).ok, false);
    const dup = validateImport(JSON.stringify({ schemaVersion: 1, persons: [person({ id: "x" }), person({ id: "x" })] }));
    assert.equal(dup.ok, false);
    assert.match(dup.errors.join(" "), /dubbel/i);
  });

  it("strips unknown keys, fills defaults and generates missing ids", () => {
    const raw = { schemaVersion: 1, persons: [{ name: "Anna", hacker: "<script>" }], evil: true };
    const result = validateImport(JSON.stringify(raw));
    assert.equal(result.ok, true);
    const p = result.state.persons[0];
    assert.equal("hacker" in p, false);
    assert.equal("evil" in result.state, false);
    assert.equal(typeof p.id, "string");
    assert.equal(p.relationship, "other");
    assert.equal(p.frequency, "monthly");
    assert.deepEqual(p.contactHistory, []);
    assert.equal(p.notes, "");
  });

  it("drops malformed contactHistory entries but keeps valid ones", () => {
    const raw = {
      schemaVersion: 1,
      persons: [{ id: "a", name: "Anna", contactHistory: [{ date: "2026-07-01", note: "ok" }, { date: "kapot" }, "nee", { note: "geen datum" }] }],
    };
    const result = validateImport(JSON.stringify(raw));
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.persons[0].contactHistory, [{ date: "2026-07-01", note: "ok" }]);
  });
});

describe("markContacted (same-day guard)", () => {
  it("does not add a duplicate entry for the same day", () => {
    const p = person({ id: "a", lastContact: TODAY, contactHistory: [{ date: TODAY, note: "" }] });
    const state = { schemaVersion: 1, persons: [p] };
    const next = markContacted(state, "a", TODAY);
    assert.equal(next.persons[0].contactHistory.length, 1);
    assert.equal(next.persons[0].lastContact, TODAY);
  });
});

describe("removeContactEntry", () => {
  const p = person({
    id: "a",
    lastContact: "2026-07-20",
    contactHistory: [
      { date: "2026-07-20", note: "recent" },
      { date: "2026-06-01", note: "ouder" },
    ],
  });
  const state = { schemaVersion: 1, persons: [p] };

  it("removes an entry and recomputes lastContact from the newest remaining", () => {
    const next = removeContactEntry(state, "a", 0);
    assert.deepEqual(next.persons[0].contactHistory, [{ date: "2026-06-01", note: "ouder" }]);
    assert.equal(next.persons[0].lastContact, "2026-06-01");
    assert.equal(state.persons[0].contactHistory.length, 2); // input untouched
  });

  it("keeps lastContact when a non-newest entry is removed", () => {
    const next = removeContactEntry(state, "a", 1);
    assert.equal(next.persons[0].lastContact, "2026-07-20");
    assert.equal(next.persons[0].contactHistory.length, 1);
  });

  it("sets lastContact to null when the last entry disappears", () => {
    const single = { schemaVersion: 1, persons: [person({ id: "a", lastContact: TODAY, contactHistory: [{ date: TODAY, note: "" }] })] };
    assert.equal(removeContactEntry(single, "a", 0).persons[0].lastContact, null);
  });

  it("ignores unknown ids and out-of-range indices", () => {
    assert.deepEqual(removeContactEntry(state, "zzz", 0), state);
    assert.deepEqual(removeContactEntry(state, "a", 99), state);
    assert.deepEqual(removeContactEntry(state, "a", -1), state);
  });
});

// ---------------------------------------------------------------------------
// Regressietests n.a.v. adversariële review
// ---------------------------------------------------------------------------

describe("parseISODate (review: Date.UTC jaar 0-99)", () => {
  it("rejects years before 1900 so validation matches epoch math", () => {
    assert.equal(parseISODate("0026-07-31"), null);
    assert.equal(parseISODate("0099-12-31"), null);
    assert.equal(parseISODate("0000-02-29"), null);
    assert.notEqual(parseISODate("1900-01-01"), null);
  });
});

describe("enum validation (review: prototype keys via 'in')", () => {
  it("rejects Object.prototype keys as frequency/relationship", () => {
    assert.throws(() => newPerson({ name: "X", frequency: "constructor" }, TODAY), /frequentie/i);
    assert.throws(() => newPerson({ name: "X", relationship: "toString" }, TODAY), /relatie/i);
    assert.throws(() => newPerson({ name: "X", frequency: "__proto__" }, TODAY), /frequentie/i);
    const result = validateImport(JSON.stringify({ schemaVersion: 1, persons: [{ id: "x", name: "A", relationship: "toString", frequency: "__proto__" }] }));
    assert.equal(result.ok, false);
    assert.throws(() => computeStatus(person({ frequency: "constructor", lastContact: TODAY }), TODAY), TypeError);
  });
});

describe("initials (review: surrogate pairs en diakrieten)", () => {
  it("keeps astral-plane characters intact", () => {
    assert.equal(initials("🌟 Kim"), "🌟K");
    assert.equal(initials("👨‍👩‍👧"), "👨👩"); // enkel woord: eerste twee codepoints (ZWJ weggefilterd)
    assert.equal(initials("Élise Örn"), "ÉÖ");
  });
});

describe("formatDue (review: grens 2 dagen)", () => {
  it("uses 'over 2 dagen' right after 'morgen'", () => {
    assert.equal(formatDue(2), "over 2 dagen");
  });
});

describe("nextBirthdayOverall (review: tie-break)", () => {
  it("breaks equal-day ties alphabetically regardless of array order", () => {
    const zoe = person({ id: "z", name: "Zoë", birthday: "08-11" });
    const anna = person({ id: "a", name: "Anna", birthday: "08-11" });
    assert.equal(nextBirthdayOverall([zoe, anna], TODAY).person.name, "Anna");
    assert.equal(nextBirthdayOverall([anna, zoe], TODAY).person.name, "Anna");
  });
});

describe("newPerson (review: lastContact zonder geschiedenis)", () => {
  it("seeds contactHistory with a matching entry when lastContact is set", () => {
    const p = newPerson({ name: "X", lastContact: "2026-07-25" }, TODAY);
    assert.deepEqual(p.contactHistory, [{ date: "2026-07-25", note: "" }]);
  });
});

describe("withLastContact", () => {
  it("sets the date and inserts a matching history entry in descending order", () => {
    const p = person({ id: "a", lastContact: "2026-07-20", contactHistory: [{ date: "2026-07-20", note: "x" }] });
    const next = withLastContact(p, "2026-07-25");
    assert.equal(next.lastContact, "2026-07-25");
    assert.deepEqual(next.contactHistory.map((e) => e.date), ["2026-07-25", "2026-07-20"]);
  });

  it("keeps the newest history date as lastContact when the form date is older", () => {
    const p = person({ id: "a", lastContact: "2026-07-20", contactHistory: [{ date: "2026-07-20", note: "" }] });
    const next = withLastContact(p, "2026-06-01");
    assert.equal(next.lastContact, "2026-07-20");
    assert.deepEqual(next.contactHistory.map((e) => e.date), ["2026-07-20", "2026-06-01"]);
  });

  it("falls back to the newest history entry when the date is cleared", () => {
    const p = person({ id: "a", lastContact: "2026-07-20", contactHistory: [{ date: "2026-07-20", note: "" }] });
    assert.equal(withLastContact(p, null).lastContact, "2026-07-20");
    assert.equal(withLastContact(person({ id: "b" }), null).lastContact, null);
  });

  it("does not duplicate an existing entry for the same date", () => {
    const p = person({ id: "a", lastContact: "2026-07-20", contactHistory: [{ date: "2026-07-20", note: "x" }] });
    assert.equal(withLastContact(p, "2026-07-20").contactHistory.length, 1);
  });
});

describe("markContacted (review: ongeordende geschiedenis)", () => {
  it("same-day guard is order-independent", () => {
    const p = person({ id: "a", lastContact: "2026-01-01", contactHistory: [{ date: "2026-01-01", note: "" }, { date: TODAY, note: "" }] });
    const next = markContacted({ schemaVersion: 1, persons: [p] }, "a", TODAY);
    assert.equal(next.persons[0].contactHistory.filter((e) => e.date === TODAY).length, 1);
  });
});

describe("removeContactEntry (review: form-set lastContact en volgorde)", () => {
  it("uses the maximum remaining date, not merely index 0", () => {
    const p = person({
      id: "a",
      lastContact: "2026-07-30",
      contactHistory: [
        { date: "2026-01-01", note: "" },
        { date: "2026-06-01", note: "" },
        { date: "2026-07-30", note: "" },
      ],
    });
    const next = removeContactEntry({ schemaVersion: 1, persons: [p] }, "a", 2);
    assert.equal(next.persons[0].lastContact, "2026-06-01");
  });

  it("preserves a lastContact that is newer than any history entry", () => {
    const p = person({ id: "a", lastContact: "2026-07-25", contactHistory: [{ date: "2026-07-20", note: "" }] });
    const next = removeContactEntry({ schemaVersion: 1, persons: [p] }, "a", 0);
    assert.equal(next.persons[0].lastContact, "2026-07-25");
    assert.deepEqual(next.persons[0].contactHistory, []);
  });
});

describe("validateImport (review: normalisatie geschiedenis en lastContact)", () => {
  it("sorts imported history newest-first", () => {
    const raw = { schemaVersion: 1, persons: [{ id: "a", name: "A", lastContact: "2026-07-30", contactHistory: [{ date: "2026-01-01", note: "" }, { date: "2026-07-30", note: "" }, { date: "2026-06-01", note: "" }] }] };
    const result = validateImport(JSON.stringify(raw));
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.persons[0].contactHistory.map((e) => e.date), ["2026-07-30", "2026-06-01", "2026-01-01"]);
  });

  it("reconciles lastContact with the history (newest wins, seeds missing entry)", () => {
    const newerHistory = validateImport(JSON.stringify({ schemaVersion: 1, persons: [{ id: "a", name: "A", lastContact: "2026-01-01", contactHistory: [{ date: "2026-07-30", note: "" }] }] }));
    assert.equal(newerHistory.state.persons[0].lastContact, "2026-07-30");
    assert.deepEqual(newerHistory.state.persons[0].contactHistory.map((e) => e.date), ["2026-07-30", "2026-01-01"]);

    const noHistory = validateImport(JSON.stringify({ schemaVersion: 1, persons: [{ id: "a", name: "A", lastContact: "2026-07-30" }] }));
    assert.deepEqual(noHistory.state.persons[0].contactHistory, [{ date: "2026-07-30", note: "" }]);
  });
});

describe("normalizeState (review: opslag mag nooit crashen)", () => {
  it("coerces primitive names and drops unusable persons", () => {
    const state = normalizeState({
      schemaVersion: 1,
      persons: [
        { id: "a", name: 5, frequency: "daily", relationship: "vijand", lastContact: "kapot", birthday: "13-40" },
        null,
        { id: "b" },
        { id: "c", name: "Echt", frequency: "weekly", extra: "weg" },
      ],
    });
    assert.equal(state.persons.length, 2);
    const [a, c] = state.persons;
    assert.equal(a.name, "5");
    assert.equal(a.frequency, "monthly");
    assert.equal(a.relationship, "other");
    assert.equal(a.lastContact, null);
    assert.equal(a.birthday, null);
    assert.equal(c.frequency, "weekly");
    assert.equal("extra" in c, false);
  });

  it("returns null for unusable roots", () => {
    assert.equal(normalizeState(null), null);
    assert.equal(normalizeState({ schemaVersion: 99 }), null);
    assert.equal(normalizeState({ schemaVersion: 1, persons: "nee" }), null);
  });
});
