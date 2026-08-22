// Magic-byte (file signature) detection. Used to verify that a file's declared
// MIME type matches its actual content — preventing attackers from uploading
// e.g. an HTML file renamed to .jpg.

export type SupportedMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "image/heif";

interface MagicPattern {
  mime: SupportedMime;
  // Bytes compared at offset 0. Hex string.
  prefix: string;
  // Optional secondary check (offset, hex)
  check?: { offset: number; hex: string };
}

const PATTERNS: MagicPattern[] = [
  { mime: "image/jpeg", prefix: "ffd8ff" },
  { mime: "image/png", prefix: "89504e47" },
  // RIFF....WEBP
  {
    mime: "image/webp",
    prefix: "52494646", // "RIFF"
    check: { offset: 8, hex: "57454250" }, // "WEBP"
  },
  // HEIC/HEIF: ISO base media file format — "ftyp" at offset 4, brand "heic" or "heif" or "mif1" at offset 8
  {
    mime: "image/heic",
    prefix: "000000",
    check: { offset: 4, hex: "6674797068656963" }, // "ftypheic"
  },
  {
    mime: "image/heif",
    prefix: "000000",
    check: { offset: 4, hex: "6674797068656966" }, // "ftypheif"
  },
];

const MIN_HEADER_BYTES = 16; // covers JPEG, PNG, RIFF/WEBP, and ISO-BMFF brands

/**
 * Detect MIME type from the first bytes of a file.
 * Returns null if no pattern matches.
 *
 * Accepts a hex string of the first >= MIN_HEADER_BYTES bytes,
 * OR a Uint8Array (uses its first bytes directly).
 */
export function detectMime(input: string | Uint8Array): SupportedMime | null {
  const bytes =
    typeof input === "string" ? hexToBytes(input) : input;
  if (bytes.length < MIN_HEADER_BYTES) return null;

  for (const pattern of PATTERNS) {
    if (!bytesStartWith(bytes, pattern.prefix)) continue;
    if (pattern.check) {
      const offset = pattern.check.offset;
      const expectedHex = pattern.check.hex;
      const actualHex = bytesToHex(
        bytes.slice(offset, offset + expectedHex.length / 2),
      );
      if (actualHex !== expectedHex) continue;
    }
    return pattern.mime;
  }

  // Special: ISO-BMFF brands "mif1" / "msf1" with "ftyp" at offset 4 → treat as HEIF-compatible
  if (
    bytesStartWith(bytes, "000000") &&
    bytesToHex(bytes.slice(4, 8)) === "66747970" // "ftyp"
  ) {
    return "image/heif";
  }

  return null;
}

/**
 * Verify that a hex header matches the declared MIME type.
 */
export function mimeMatchesHeader(
  declared: string,
  headerHex: string | Uint8Array,
): boolean {
  const detected = detectMime(headerHex);
  return detected !== null && detected === declared;
}

function bytesStartWith(bytes: Uint8Array, hexPrefix: string): boolean {
  if (bytes.length * 2 < hexPrefix.length) return false;
  const actualHex = bytesToHex(bytes.slice(0, hexPrefix.length / 2));
  return actualHex === hexPrefix.toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase();
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").trim();
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Whitelist of accepted MIME types for uploads.
 * Server should reject anything outside this list.
 */
export const ALLOWED_MIMES: readonly SupportedMime[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function isAllowedMime(mime: string): mime is SupportedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}
