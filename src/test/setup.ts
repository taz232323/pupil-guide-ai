import "@testing-library/jest-dom";

// jsdom's localStorage isn't reliably available here; provide a working in-memory shim.
const __store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  writable: true,
  configurable: true,
  value: {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(__store, k) ? __store[k] : null),
    setItem: (k: string, v: string) => {
      __store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete __store[k];
    },
    clear: () => {
      for (const k of Object.keys(__store)) delete __store[k];
    },
    key: (i: number) => Object.keys(__store)[i] ?? null,
    get length() {
      return Object.keys(__store).length;
    },
  },
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
