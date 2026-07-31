import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseISODate,
  isValidISODate,
  diffDays,
  addDays,
  todayISO,
} from "../js/logic.js";

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
