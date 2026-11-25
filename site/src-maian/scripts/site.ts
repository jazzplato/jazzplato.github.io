// Maian's page behaviour: the nav on scroll and on phones, reveal on scroll, the counting stats, the
// search prompt, the photo lightbox, the writing filters and the links to the other designs.
import { paintAll, paintTiles } from './paint';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)] as T[];

// ---- nav
const nav = document.querySelector<HTMLElement>('.nav');
const onScroll = () => nav?.classList.toggle('is-scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menu = document.querySelector<HTMLButtonElement>('[data-menu]');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('menu-open', open);
});

// ---- reveal and counters
const counters = (root: Element) => {
  for (const el of $$('[data-count]', root)) {
    const to = Number(el.dataset.count);
    if (still || !Number.isFinite(to)) continue;
    const t0 = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }
};
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      counters(e.target);
      reveal.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
);
document.documentElement.classList.add('js');
for (const el of $$('[data-reveal]')) reveal.observe(el);

// ---- search: every [data-search] box filters /search.json as you type
interface Hit {
  title: string;
  subtitle: string;
  tags: string[];
  url: string;
  date: string;
  kind: string;
  lang: string;
}
let index: Promise<Hit[]> | undefined;
const kinds: Record<string, string> = { production: 'Production', essay: 'Essay', review: 'Review', movie: 'Film' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

for (const box of $$('[data-search]')) {
  const input = box.querySelector<HTMLInputElement>('input')!;
  const list = box.querySelector<HTMLElement>('[data-results]')!;
  let filter = '';
  const run = async () => {
    const q = input.value.trim().toLowerCase();
    if (!q && !filter) {
      list.hidden = true;
      list.innerHTML = '';
      box.classList.remove('has-results');
      return;
    }
    index ??= fetch('/search.json').then((r) => r.json());
    const all = await index;
    const words = q.split(/\s+/).filter(Boolean);
    const hits = all
      .filter((h) => !filter || h.kind === filter || (filter === 'writing' && h.kind !== 'production'))
      .filter((h) => {
        const hay = `${h.title} ${h.subtitle} ${h.tags.join(' ')} ${h.date.slice(0, 4)}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 7);
    list.innerHTML = hits.length
      ? hits
          .map(
            (h) =>
              `<li><a href="${h.url}"><span class="result__title"${h.lang !== 'en' ? ` lang="${h.lang}"` : ''}>${esc(h.title)}</span><span class="result__meta">${kinds[h.kind] ?? ''} · ${h.date.slice(0, 4)}</span></a></li>`,
          )
          .join('')
      : `<li class="result--none">Nothing matches “${esc(input.value.trim())}”. Try a show, a city or a year.</li>`;
    list.hidden = false;
    box.classList.add('has-results');
  };
  input.addEventListener('input', run);
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const first = list.querySelector<HTMLAnchorElement>('a');
    if (first) location.href = first.href;
    else run();
  });
  for (const chip of $$<HTMLButtonElement>('[data-chip]', box)) {
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') !== 'true';
      for (const c of $$('[data-chip]', box)) c.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-pressed', String(on));
      filter = on ? chip.dataset.chip! : '';
      input.focus();
      run();
    });
  }
}

const dialog = document.querySelector<HTMLDialogElement>('.search-dialog');
const openSearch = () => {
  if (!dialog) return;
  dialog.showModal();
  dialog.querySelector('input')?.focus();
};
for (const b of $$('[data-open-search]')) b.addEventListener('click', openSearch);
dialog?.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable]');
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    openSearch();
  }
});

// ---- lightbox: the gallery photographs at their own size, arrow keys step through them
const box = document.querySelector<HTMLDialogElement>('.lightbox');
if (box) {
  const links = $$<HTMLAnchorElement>('[data-lightbox]');
  const img = box.querySelector('img')!;
  const count = box.querySelector<HTMLElement>('[data-lightbox-count]')!;
  let at = 0;
  const show = (i: number) => {
    at = (i + links.length) % links.length;
    const a = links[at];
    const thumb = a.querySelector('img');
    img.src = a.href;
    img.alt = thumb?.alt ?? '';
    count.textContent = `${at + 1} / ${links.length}`;
  };
  links.forEach((a, i) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(i);
      box.showModal();
    }),
  );
  box.querySelector('[data-prev]')?.addEventListener('click', () => show(at - 1));
  box.querySelector('[data-next]')?.addEventListener('click', () => show(at + 1));
  box.querySelector('[data-close]')?.addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => {
    if (e.target === box) box.close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'ArrowRight') show(at + 1);
  });
}

// ---- rows: one highlight glides to the row under the pointer or the focus, and fades when it leaves
if (matchMedia('(hover: hover)').matches) {
  for (const list of $$('.rows')) {
    const glide = document.createElement('span');
    glide.className = 'rows__glide';
    glide.setAttribute('aria-hidden', 'true');
    list.prepend(glide);
    const light = (row: HTMLElement | null) => {
      if (!row) return;
      // arriving from outside the list: place it under the row first, then only fade in
      const arriving = !list.classList.contains('is-gliding');
      glide.classList.toggle('is-placing', arriving);
      glide.style.setProperty('--y', `${row.offsetTop}px`);
      glide.style.height = `${row.offsetHeight}px`;
      if (arriving) void glide.offsetWidth;
      list.classList.add('is-gliding');
      if (arriving) requestAnimationFrame(() => glide.classList.remove('is-placing'));
    };
    const rowOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('.row') : null);
    list.addEventListener('pointerover', (e) => light(rowOf(e.target)));
    list.addEventListener('pointerleave', () => list.classList.remove('is-gliding'));
    list.addEventListener('focusin', (e) => light(rowOf(e.target)));
    list.addEventListener('focusout', (e) => {
      if (!list.contains(e.relatedTarget as Node | null)) list.classList.remove('is-gliding');
    });
  }
}

// ---- language: an English and a Chinese text, one shown at a time
for (const group of $$('[data-lang-toggle]')) {
  const scope = group.closest('section') ?? document;
  for (const b of $$<HTMLButtonElement>('[data-lang]', group)) {
    b.addEventListener('click', () => {
      for (const o of $$('[data-lang]', group)) o.setAttribute('aria-pressed', String(o === b));
      for (const pane of $$('[data-lang-pane]', scope)) pane.hidden = pane.dataset.langPane !== b.dataset.lang;
    });
  }
}

// ---- filters: pills over a card grid ([data-filter-group] > [data-filter], cards with data-kind)
for (const group of $$('[data-filter-group]')) {
  const target = document.getElementById(group.dataset.filterGroup!);
  if (!target) continue;
  for (const pill of $$<HTMLButtonElement>('[data-filter]', group)) {
    pill.addEventListener('click', () => {
      for (const p of $$('[data-filter]', group)) p.setAttribute('aria-pressed', String(p === pill));
      const k = pill.dataset.filter!;
      for (const card of $$('[data-kind]', target)) card.hidden = k !== 'all' && card.dataset.kind !== k;
    });
  }
}

// ---- rails: the arrow buttons scroll by one screen of cards
for (const rail of $$('[data-rail]')) {
  const track = rail.querySelector<HTMLElement>('[data-rail-track]')!;
  const by = (dir: number) => track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: still ? 'auto' : 'smooth' });
  rail.querySelector('[data-rail-prev]')?.addEventListener('click', () => by(-1));
  rail.querySelector('[data-rail-next]')?.addEventListener('click', () => by(1));
}

// ---- the same address in the other designs
for (const a of $$<HTMLAnchorElement>('[data-same-path]')) a.href = a.href.replace(/\/$/, '') + location.pathname;
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
  const a = document.querySelector<HTMLAnchorElement>(`[data-key="${e.key}"]`);
  if (a) location.href = a.href;
});

paintAll();
paintTiles();
