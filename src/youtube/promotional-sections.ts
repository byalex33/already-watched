import { SELECTORS } from './selectors';

export function isPromotionalHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim().replace(/[.!:]+$/, '').toLowerCase();
  return ['youtube playables', 'playables', 'instant games, no downloads', 'explore more topics'].includes(normalized);
}

export function isPromotionalSection(section: HTMLElement): boolean {
  // Match shelf headings, never arbitrary text or a video's title/description.
  // A nested shelf owns its own heading, not the outer feed or sibling shelves.
  return [...section.querySelectorAll<HTMLElement>(SELECTORS.promotionalHeadings)].some(heading =>
    heading.closest(SELECTORS.promotionalSections) === section
    && !heading.closest(SELECTORS.cards)
    && isPromotionalHeading(heading.textContent ?? '')
  );
}

export function promotionalContainer(section: HTMLElement): HTMLElement {
  const outer = section.closest<HTMLElement>(SELECTORS.promotionalOuter);
  return outer && outer.querySelectorAll(SELECTORS.promotionalShelves).length === 1 ? outer : section;
}

export function findPromotionalSections(root: Element | Document): Set<HTMLElement> {
  const sections = new Set<HTMLElement>();
  if (root instanceof Element) {
    let parent = root.closest<HTMLElement>(SELECTORS.promotionalSections);
    while (parent) {
      sections.add(parent);
      parent = parent.parentElement?.closest<HTMLElement>(SELECTORS.promotionalSections) ?? null;
    }
  }
  root.querySelectorAll<HTMLElement>(SELECTORS.promotionalSections).forEach(section => sections.add(section));
  // An update inside a shared wrapper must re-evaluate its existing shelves too.
  for (const section of [...sections]) section.querySelectorAll<HTMLElement>(SELECTORS.promotionalSections).forEach(child => sections.add(child));
  return sections;
}
