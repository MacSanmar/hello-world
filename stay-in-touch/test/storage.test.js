import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStorage, memoryBackend } from "../js/storage.js";
import { emptyState } from "../js/logic.js";

const STATE = {
  schemaVersion: 1,
  persons: [
    {
      id: "a",
      name: "Anna",
      relationship: "friend",
      frequency: "monthly",
      lastContact: "2026-07-01",
      birthday: null,
      notes: "",
      contactHistory: [{ date: "2026-07-01", note: "" }],
      createdAt: "2026-01-01",
    },
  ],
};

function throwingBackend() {
  const boom = () => {
    throw new Error("QuotaExceededError");
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

describe("createStorage", () => {
  it("reports availability of the backend", () => {
    assert.equal(createStorage(memoryBackend()).available(), true);
    assert.equal(createStorage(throwingBackend()).available(), false);
  });

  it("loads a fresh empty state when nothing is stored", () => {
    assert.deepEqual(createStorage(memoryBackend()).load(), emptyState());
  });

  it("round-trips save and load", () => {
    const storage = createStorage(memoryBackend());
    assert.equal(storage.save(STATE), true);
    assert.deepEqual(storage.load(), STATE);
  });

  it("recovers from corrupted stored JSON", () => {
    const backend = memoryBackend();
    backend.setItem("stayintouch.v1", "{kapot!!");
    assert.deepEqual(createStorage(backend).load(), emptyState());
  });

  it("recovers from stored data with an unsupported schema", () => {
    const backend = memoryBackend();
    backend.setItem("stayintouch.v1", JSON.stringify({ schemaVersion: 99 }));
    assert.deepEqual(createStorage(backend).load(), emptyState());
  });

  it("never throws when the backend fails", () => {
    const storage = createStorage(throwingBackend());
    assert.deepEqual(storage.load(), emptyState());
    assert.equal(storage.save(STATE), false);
  });

  it("round-trips the theme and rejects invalid stored values", () => {
    const storage = createStorage(memoryBackend());
    assert.equal(storage.loadTheme(), null);
    storage.saveTheme("dark");
    assert.equal(storage.loadTheme(), "dark");
    storage.saveTheme(null);
    assert.equal(storage.loadTheme(), null);

    const backend = memoryBackend();
    backend.setItem("stayintouch.theme", "paars");
    assert.equal(createStorage(backend).loadTheme(), null);
  });
});

describe("createStorage (review-regressies)", () => {
  it("recovers from schemaVersion 1 with a non-array persons", () => {
    const backend = memoryBackend();
    backend.setItem("stayintouch.v1", JSON.stringify({ schemaVersion: 1, persons: "nee" }));
    assert.deepEqual(createStorage(backend).load(), emptyState());
  });

  it("normalizes malformed persons instead of passing them through", () => {
    const backend = memoryBackend();
    backend.setItem(
      "stayintouch.v1",
      JSON.stringify({ schemaVersion: 1, persons: [{ id: "a", name: 5, frequency: "daily" }, null, { id: "b", name: "Echt" }] })
    );
    const state = createStorage(backend).load();
    assert.equal(state.persons.length, 2);
    assert.equal(state.persons[0].name, "5");
    assert.equal(state.persons[0].frequency, "monthly");
    assert.equal(state.persons[1].name, "Echt");
  });

  it("preserves unreadable data under a rescue key instead of silently losing it", () => {
    const backend = memoryBackend();
    backend.setItem("stayintouch.v1", "{kapot!!");
    const storage = createStorage(backend);
    assert.equal(storage.hasRescue(), false);
    assert.deepEqual(storage.load(), emptyState());
    assert.equal(backend.getItem("stayintouch.v1.corrupt"), "{kapot!!");
    assert.equal(storage.hasRescue(), true);
    // een latere save() overschrijft de reservekopie niet
    storage.save({ schemaVersion: 1, persons: [] });
    assert.equal(backend.getItem("stayintouch.v1.corrupt"), "{kapot!!");
  });

  it("does not create a rescue copy when nothing was stored", () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);
    storage.load();
    assert.equal(backend.getItem("stayintouch.v1.corrupt"), null);
    assert.equal(storage.hasRescue(), false);
  });
});

describe("detectBackend", () => {
  it("falls back to a working in-memory backend without localStorage", async () => {
    const { detectBackend } = await import("../js/storage.js");
    const { backend, persistent } = detectBackend(); // Node heeft geen localStorage
    assert.equal(persistent, false);
    backend.setItem("k", "v");
    assert.equal(backend.getItem("k"), "v");
    backend.removeItem("k");
    assert.equal(backend.getItem("k"), null);
  });
});
