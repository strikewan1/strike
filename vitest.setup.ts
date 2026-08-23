// Vitest setup — runs before each test file.
// Polyfills needed by component tests under jsdom.
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia / ResizeObserver which
// react-easy-crop and some Radix primitives use.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = () =>
      ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as never;
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
  }
}
