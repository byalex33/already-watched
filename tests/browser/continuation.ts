import { activateContinuation } from '../../src/youtube/continuation';
const target = document.querySelector<HTMLElement>('ytd-continuation-item-renderer')!;
const status = document.querySelector<HTMLElement>('#status')!;
let intersections = 0;
const observer = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) intersections++;
});
observer.observe(target);
document.querySelector<HTMLButtonElement>('#activate')!.onclick = () => {
  const before = window.scrollY;
  const cleanup = activateContinuation(target);
  status.textContent = 'Checking native loading…';
  setTimeout(() => {
    cleanup?.();
    status.textContent = `Native intersections: ${intersections}; scroll preserved: ${window.scrollY === before}; temporary style removed: ${!target.classList.contains('aw-refill-probe')}`;
  }, 700);
};
