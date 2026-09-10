// Only accept explicit English view labels. Unknown/localized labels stay
// visible; dates, subscriber counts and live viewer counts are not views.
export function parseViewCount(text: string): number | null {
  const label = text.replace(/[\u00a0\u202f]/g, ' ').trim();
  if (/^no views$/i.test(label)) return 0;
  const match = label.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([KMB])?\s+views?$/i);
  if (!match?.[1]) return null;
  if (!match[2] && match[1].includes('.')) return null;
  const multiplier = ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[match[2]?.toUpperCase() ?? ''] ?? 1;
  const count = Number(match[1].replace(/,/g, '')) * multiplier;
  return Number.isSafeInteger(Math.round(count)) ? Math.round(count) : null;
}

export function youtubeViewCount(element: HTMLElement): number | null {
  const metadata = element.querySelectorAll('#metadata-line span, .ytContentMetadataViewModelMetadataText, .yt-content-metadata-view-model__metadata-text, .yt-content-metadata-view-model-wiz__metadata-text, .shortsLockupViewModelHostMetadataSubhead, #view-count, .view-count');
  for (const node of metadata) {
    const count = parseViewCount(node.textContent ?? '');
    if (count !== null) return count;
  }
  return null;
}
