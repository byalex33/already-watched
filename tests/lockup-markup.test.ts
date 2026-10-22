import { beforeEach, describe, expect, it } from 'vitest';
import { CardDecorator } from '../src/content/card-decorator';
import { detectCard } from '../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { matchesContentFilters } from '../src/shared/content-filters';
const id = 'dQw4w9WgXcQ';
const title = 'Camping Under the Snow in Survival Shelter';

// Home lockups as YouTube rendered them in October 2026: camelCase classes,
// with the title only inside the metadata heading.
function lockup(): HTMLElement {
  document.body.innerHTML = `<ytd-rich-item-renderer><yt-lockup-view-model>
    <a class="ytLockupViewModelContentImage" href="/watch?v=${id}"><yt-thumbnail-view-model><img alt=""></yt-thumbnail-view-model></a>
    <div class="ytLockupViewModelMetadata">
      <h3 class="ytLockupMetadataViewModelHeadingReset" title="${title}">
        <a class="ytLockupMetadataViewModelTitle" href="/watch?v=${id}"><span class="ytAttributedStringHost">${title}</span></a>
      </h3>
      <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" aria-label="18 million views">18m</span>
    </div>
  </yt-lockup-view-model></ytd-rich-item-renderer>`;
  return document.body.firstElementChild as HTMLElement;
}
beforeEach(() => { document.body.innerHTML = ''; history.replaceState({}, '', '/'); });

describe('camelCase lockup markup', () => {
  it('reads the title and uses the content image as the thumbnail', () => {
    const root = lockup();
    expect(detectCard(root)).toMatchObject({ videoId: id, title, views: 18_000_000, shorts: false });
    expect(detectCard(root)?.thumbnail).toBe(root.querySelector('a.ytLockupViewModelContentImage'));
  });
  it('lets title-word filters match Home lockups', () => {
    const card = detectCard(lockup())!;
    expect(matchesContentFilters(card, { ...DEFAULT_SETTINGS, blockedTitleTerms: ['survival shelter'] })).toBe(true);
  });
  it('names the video on the thumbnail control', () => {
    const card = detectCard(lockup())!;
    new CardDecorator(() => undefined).apply(card, false, undefined, DEFAULT_SETTINGS);
    expect(card.thumbnail.querySelector('.aw-control')?.getAttribute('aria-label')).toBe(`Mark as watched: ${title}`);
  });
});
