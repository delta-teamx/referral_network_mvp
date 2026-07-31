/**
 * Split a "services offered" input into clean list items WITHOUT chopping prose.
 *
 * New lines and semicolons are always separators. A comma splits a line ONLY
 * when every comma-separated part is short (a tag list like
 * "Web design, SEO, branding"); if any part is long, the line is a sentence and
 * is kept whole - so a paragraph never breaks into incomplete fragments (the
 * bug a member hit when they pasted a paragraph and got half-sentence bubbles).
 */
export function splitServiceList(raw: string, itemMax = 100, listMax = 15): string[] {
  return raw
    .split(/[\n;]+/)
    .flatMap((seg) => {
      const parts = seg.split(',').map((s) => s.trim()).filter(Boolean);
      const looksLikeTags = parts.length > 1 && parts.every((p) => p.length <= 40);
      return looksLikeTags ? parts : [seg.trim()];
    })
    .map((s) => s.trim().slice(0, itemMax))
    .filter(Boolean)
    .slice(0, listMax);
}
