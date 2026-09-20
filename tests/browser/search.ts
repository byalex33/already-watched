import { CardDecorator } from '../../src/content/card-decorator';
import { detectCard } from '../../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';

const card = detectCard(document.querySelector<HTMLElement>('ytd-video-renderer')!)!;
const decorator = new CardDecorator(() => {});
const host = card.thumbnail.parentElement!;
const before = host.getBoundingClientRect();
decorator.apply(card, true, undefined, DEFAULT_SETTINGS);
const after = host.getBoundingClientRect();
const anchor = card.thumbnail.getBoundingClientRect();
const button = card.thumbnail.querySelector('button')!.getBoundingClientRect();
const passed = before.height === after.height && Math.abs(after.width / after.height - 16 / 9) < .01
  && anchor.top === after.top && anchor.height === after.height
  && button.top >= anchor.top && button.bottom <= anchor.bottom;
document.querySelector('#status')!.textContent = `${passed ? 'PASS' : 'FAIL'}: thumbnail stays ${after.width} × ${after.height}; controls stay inside it`;
if (!passed) throw new Error('Search thumbnail layout changed during decoration');
