import { CardDecorator } from '../../src/content/card-decorator';
import { detectCard } from '../../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';
const grid = document.querySelector<HTMLElement>('ytd-rich-grid-renderer > #contents')!;
const decorator = new CardDecorator(() => undefined);
for (let index = 1; index <= 7; index++) {
  if (index === 7) {
    const shelf = document.createElement('ytd-rich-section-renderer');
    shelf.textContent = 'Full-width shelf'; grid.append(shelf);
  }
  const card = document.createElement('ytd-rich-item-renderer'); card.id = `card-${index}`;
  card.innerHTML = `<a id="thumbnail" href="https://www.youtube.com/watch?v=video00000${index}"><img alt="Video ${index}">Video ${index}</a>`;
  grid.append(card);
  decorator.apply(detectCard(card)!, index === 6, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide' });
}
requestAnimationFrame(() => {
  const before = document.querySelector('#card-4')!.getBoundingClientRect();
  const after = document.querySelector('#card-7')!.getBoundingClientRect();
  const pass = Math.abs(after.top - before.top) < 1;
  document.querySelector('#status')!.textContent = `${pass ? 'PASS' : 'FAIL'}: next video ${pass ? 'fills' : 'does not fill'} the blank slot before the shelf (${Math.round(after.top - before.top)}px row difference).`;
});
