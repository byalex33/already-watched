import { describe, expect, it, vi } from 'vitest';
import { detectCard } from '../src/content/card-detector';
import { CardDecorator } from '../src/content/card-decorator';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { parseViewCount, youtubeViewCount } from '../src/youtube/view-count';
import { CardObserver } from '../src/content/observer';

describe('YouTube abbreviated view metadata', () => {
  it.each([
    ['54 thousand views', 54_000], ['28 million views', 28_000_000],
    ['1.1 million views', 1_100_000], ['1.5 billion views', 1_500_000_000],
    ['54k', null], ['54 thousand subscribers', null], ['54 thousand watching', null],
  ])('reads only explicit view counts: %s', (label, expected) => {
    expect(parseViewCount(label as string)).toBe(expected);
  });

  it('rechecks a count when only the accessibility label changes', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<ytd-rich-item-renderer>
      <a id="thumbnail" href="/watch?v=abcdefghijk"><img></a>
      <span class="ytContentMetadataViewModelMetadataText" role="text">54k</span>
    </ytd-rich-item-renderer>`;
    const root = document.body.firstElementChild as HTMLElement;
    const metadata = root.querySelector('span')!;
    const decorator = new CardDecorator(vi.fn());
    const observer = new CardObserver(roots => {
      for (const element of roots) decorator.apply(detectCard(element)!, false, undefined, { ...DEFAULT_SETTINGS, minimumViews: 250_000 });
    }, vi.fn());
    try {
      observer.start();
      expect(youtubeViewCount(root)).toBeNull();
      metadata.setAttribute('aria-label', '54 thousand views');
      await vi.advanceTimersByTimeAsync(500);
      expect(root.classList.contains('aw-hidden')).toBe(true);
      metadata.setAttribute('aria-label', '388 thousand views');
      await vi.advanceTimersByTimeAsync(500);
      expect(root.classList.contains('aw-hidden')).toBe(false);
    } finally {
      observer.stop();
      vi.useRealTimers();
    }
  });

  it('hides a video below the minimum when only its accessibility label says views', () => {
    document.body.innerHTML = `<ytd-rich-item-renderer>
      <a id="thumbnail" href="/watch?v=abcdefghijk"><img></a>
      <span class="ytContentMetadataViewModelMetadataText" aria-label="54 thousand views" role="text">54k</span>
    </ytd-rich-item-renderer>`;
    const root = document.body.firstElementChild as HTMLElement;
    new CardDecorator(vi.fn()).apply(detectCard(root)!, false, undefined, { ...DEFAULT_SETTINGS, minimumViews: 250_000 });
    expect(root.classList.contains('aw-hidden')).toBe(true);
  });
});
