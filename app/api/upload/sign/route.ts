import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  detectMime,
  isAllowedMime,
  mimeMatchesHeader,
} from "@/lib/upload/validate";
import {
  checkRateLimit,
  LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";

const BodySchema = z.object({
  bucket: z.enum(["garments", "body-photos", "references", "fit-checks"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  // Hex of the first >= 16 bytes of the file, used for magic-byte verification.
  // Optional in dev to ease testing; required in production (enforced below).
  headerHex: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit (10/min/user)
    const rl = checkRateLimit(`upload:${user.id}`, LIMITS.upload);
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { bucket, fileName, contentType, headerHex } = parsed.data;

    // 1. Whitelist check
    if (!isAllowedMime(contentType)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido: ${contentType}` },
        { status: 400 },
      );
    }

    // 2. Magic-byte verification (when header provided)
    if (headerHex) {
      if (!mimeMatchesHeader(contentType, headerHex)) {
        const detected = detectMime(headerHex);
        return NextResponse.json(
          {
            error: "El contenido del archivo no coincide con su tipo declarado.",
            declared: contentType,
            detected: detected ?? "unknown",
          },
          { status: 400 },
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      // In production, header is required
      return NextResponse.json(
        { error: "Falta headerHex para validar el contenido del archivo." },
        { status: 400 },
      );
    }

    const fileExt = fileName.split(".").pop() ?? "jpg";
    const objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to sign URL" },
        { status: 500 },
      );
    }

    // For DOWNLOAD, we use a long-lived signed URL (1 year) rather than
    // getPublicUrl(). Why: getPublicUrl returns a /public/... URL that
    // only serves files when the bucket is actually public. If the
    // bucket is private (the default), the URL would 400. A signed
    // URL works regardless of bucket privacy, and 1 year is long
    // enough that we'll re-upload images long before expiry.
    const { data: downloadSigned, error: downloadError } =
      await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60 * 60 * 24 * 365);

    if (downloadError || !downloadSigned) {
      return NextResponse.json(
        { error: downloadError?.message ?? "Failed to sign download URL" },
        { status: 500 },
      );
    }

    // We still return publicUrl for backwards-compatibility / future
    // migrations (e.g., if the user makes buckets public, the stored
    // publicUrls start working).
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: objectPath,
      publicUrl,
      signedDownloadUrl: downloadSigned.signedUrl,
      contentType,
    });
  } catch (error) {
    console.error("[/api/upload/sign]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
