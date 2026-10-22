"use client";

/**
 * OCR assist (client-side only): reads text from a photo of a printed code or
 * label with Tesseract.js, loaded on demand so it never slows the app down.
 * The result is only a suggestion — every field it fills stays editable.
 */
export async function ocrFromImage(file: File): Promise<string> {
  const Tesseract = (await import("tesseract.js")).default;
  const { data } = await Tesseract.recognize(file, "eng");
  return (data.text || "").replace(/\s+/g, " ").trim();
}

/** Picks the most code-like token (letters/digits/dashes) out of OCR text. */
export function extractCodeCandidate(text: string): string {
  const tokens = text.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const scored = tokens
    .map((tok) => ({
      tok,
      score:
        (/\d/.test(tok) ? 2 : 0) +
        (/^[A-Za-z]+-\d+/.test(tok) ? 3 : 0) +
        Math.min(tok.length, 8) / 8,
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.tok ?? text.trim();
}
