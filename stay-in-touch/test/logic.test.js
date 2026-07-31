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
