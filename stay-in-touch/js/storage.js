// Opslaglaag: dun wrappertje om localStorage (of een fallback) heen.
// De backend is injecteerbaar zodat tests een in-memory variant gebruiken.

import { emptyState, normalizeState } from "./logic.js";

const DATA_KEY = "stayintouch.v1";
const RESCUE_KEY = "stayintouch.v1.corrupt";
const THEME_KEY = "stayintouch.theme";
const PROBE_KEY = "stayintouch.probe";

export function memoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function createStorage(backend) {
  return {
    available() {
      try {
        backend.setItem(PROBE_KEY, "1");
        backend.removeItem(PROBE_KEY);
        return true;
      } catch {
        return false;
      }
    },

    // Gooit nooit: ontbrekende, corrupte of niet-ondersteunde data levert een
    // verse lege state op. Onleesbare data wordt eerst onder een reservesleutel
    // bewaard, zodat een latere save() het origineel niet stilletjes vernietigt.
    load() {
      let raw = null;
      try {
        raw = backend.getItem(DATA_KEY);
        if (raw == null) return emptyState();
        const state = normalizeState(JSON.parse(raw));
        if (state) return state;
      } catch {
        // valt door naar de reservekopie hieronder
      }
      try {
        if (raw != null && backend.getItem(RESCUE_KEY) == null) {
          backend.setItem(RESCUE_KEY, raw);
        }
      } catch {
        // reservekopie is nice-to-have
      }
      return emptyState();
    },

    // Is er bij een eerdere load() onleesbare data veiliggesteld?
    hasRescue() {
      try {
        return backend.getItem(RESCUE_KEY) != null;
      } catch {
        return false;
      }
    },

    save(state) {
      try {
        backend.setItem(DATA_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false; // bv. QuotaExceededError — de app toont dan een melding
      }
    },

    loadTheme() {
      try {
        const theme = backend.getItem(THEME_KEY);
        return theme === "light" || theme === "dark" ? theme : null;
      } catch {
        return null;
      }
    },

    saveTheme(theme) {
      try {
        if (theme == null) backend.removeItem(THEME_KEY);
        else backend.setItem(THEME_KEY, theme);
      } catch {
        // opslaan van het thema is nice-to-have; stil negeren
      }
    },
  };
}

// In de browser: localStorage als die werkt, anders een in-memory fallback
// zodat de app blijft functioneren (met een waarschuwing in de UI).
export function detectBackend() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem(PROBE_KEY, "1");
    ls.removeItem(PROBE_KEY);
    return { backend: ls, persistent: true };
  } catch {
    return { backend: memoryBackend(), persistent: false };
  }
}
