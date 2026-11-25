// Design v3: the hero light answers the pointer and the scroll. Each .v3-aura gets --px/--py (-1..1,
// eased) from the pointer and --v3-s (0..1) from how far its hero has scrolled away; v3.css turns those
// into blob drift, saturation and hue. Nothing loops: with no input the light rests. Reduced motion: off.
const auras = [...document.querySelectorAll('.v3-aura')];
const still = matchMedia('(prefers-reduced-motion: reduce)');

if (auras.length && !still.matches) {
  const target = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  let s = -1;
  let raf = 0;
  let visible = true;

  const scrollOf = () => {
    const hero = auras[0].parentElement;
    const r = hero.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  };

  const frame = () => {
    raf = 0;
    now.x += (target.x - now.x) * 0.08;
    now.y += (target.y - now.y) * 0.08;
    const ns = scrollOf();
    const moving = Math.abs(target.x - now.x) > 0.002 || Math.abs(target.y - now.y) > 0.002;
    if (visible) {
      for (const a of auras) {
        a.style.setProperty('--px', now.x.toFixed(3));
        a.style.setProperty('--py', now.y.toFixed(3));
        if (ns !== s) a.style.setProperty('--v3-s', ns.toFixed(3));
      }
    }
    s = ns;
    if (moving) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
      kick();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    target.x = 0;
    target.y = 0;
    kick();
  });
  addEventListener('scroll', kick, { passive: true });

  // Phones and tablets: a slow tilt stands in for the pointer when the device reports one.
  addEventListener(
    'deviceorientation',
    (e) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      kick();
    },
    { passive: true },
  );

  new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    if (visible) kick();
  }).observe(auras[0].parentElement);

  kick();
}
