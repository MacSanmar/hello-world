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
      contactHistory: [],
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
