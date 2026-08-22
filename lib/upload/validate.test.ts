import { describe, it, expect } from "vitest";
import {
  detectMime,
  mimeMatchesHeader,
  isAllowedMime,
  ALLOWED_MIMES,
} from "@/lib/upload/validate";

// Build a Buffer with the given hex bytes (first N bytes of a file)
function buf(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("detectMime", () => {
  it("detects JPEG (FF D8 FF)", () => {
    // Need at least 16 bytes (32 hex chars)
    expect(detectMime(buf("ffd8ffe000104a4649460000000000000000"))).toBe(
      "image/jpeg",
    );
  });

  it("detects PNG (89 50 4E 47)", () => {
    expect(
      detectMime(buf("89504e470d0a1a0a0000000d4948445200000000")),
    ).toBe("image/png");
  });

  it("detects WebP (RIFF...WEBP)", () => {
    expect(detectMime(buf("524946462a00000057454250563200000000"))).toBe(
      "image/webp",
    );
  });

  it("rejects RIFF without WEBP", () => {
    expect(detectMime(buf("524946462a00000057415645560000000000"))).toBeNull();
  });

  it("detects HEIC (ftypheic at offset 4)", () => {
    expect(detectMime(buf("0000001866747970686569630000000000000000"))).toBe(
      "image/heic",
    );
  });

  it("detects HEIF (ftypheif at offset 4)", () => {
    expect(detectMime(buf("0000001866747970686569660000000000000000"))).toBe(
      "image/heif",
    );
  });

  it("detects HEIF-compatible brands (mif1) as image/heif", () => {
    expect(detectMime(buf("00000018667479706d6966310000000000000000"))).toBe(
      "image/heif",
    );
  });

  it("returns null for plain text", () => {
    const text = new TextEncoder().encode(
      "Hello world! this is a long string for the test to pass the minimum",
    );
    expect(detectMime(text)).toBeNull();
  });

  it("returns null for HTML (attack vector)", () => {
    const html = new TextEncoder().encode(
      "<!DOCTYPE html><html><script>alert(1)</script>",
    );
    expect(detectMime(html)).toBeNull();
  });

  it("returns null for too-short input", () => {
    expect(detectMime(buf("ffd8ff"))).toBeNull();
  });

  it("accepts hex string input", () => {
    expect(detectMime("ffd8ffe000104a4649460000000000000000")).toBe(
      "image/jpeg",
    );
  });
});

describe("mimeMatchesHeader", () => {
  it("returns true when declared matches detected", () => {
    expect(
      mimeMatchesHeader("image/jpeg", "ffd8ffe000104a4649460000000000000000"),
    ).toBe(true);
    expect(
      mimeMatchesHeader("image/png", "89504e470d0a1a0a0000000d4948445200000000"),
    ).toBe(true);
  });

  it("returns false on mismatch (PNG declared, JPEG content)", () => {
    expect(
      mimeMatchesHeader("image/png", "ffd8ffe000104a4649460000000000000000"),
    ).toBe(false);
  });

  it("rejects HTML disguised as image", () => {
    const htmlHex = Buffer.from(
      "<!DOCTYPE html><html><script>alert(1)</script>",
      "utf-8",
    ).toString("hex");
    expect(mimeMatchesHeader("image/jpeg", htmlHex)).toBe(false);
  });
});

describe("isAllowedMime / ALLOWED_MIMES", () => {
  it("accepts image/jpeg", () => {
    expect(isAllowedMime("image/jpeg")).toBe(true);
  });

  it("accepts all 5 image types", () => {
    expect(ALLOWED_MIMES).toContain("image/jpeg");
    expect(ALLOWED_MIMES).toContain("image/png");
    expect(ALLOWED_MIMES).toContain("image/webp");
    expect(ALLOWED_MIMES).toContain("image/heic");
    expect(ALLOWED_MIMES).toContain("image/heif");
  });

  it("rejects HTML", () => {
    expect(isAllowedMime("text/html")).toBe(false);
  });

  it("rejects SVG (XSS vector)", () => {
    expect(isAllowedMime("image/svg+xml")).toBe(false);
  });

  it("rejects PDF", () => {
    expect(isAllowedMime("application/pdf")).toBe(false);
  });
});
