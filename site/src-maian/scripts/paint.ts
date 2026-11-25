// The painted light behind Maian's hero panels: soft fields of pigment brushed along a diagonal, under
// fine grain. It leans toward the pointer and shifts colour and depth as the page scrolls. Each panel
// ([data-paint]) passes its five colours; without WebGL, or with reduced motion, the CSS gradient under
// the canvas stays, or one still frame is drawn.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec2 u_m;      // pointer, 0..1 in the panel, eased
uniform float u_s;     // scroll, 0 at rest .. 1 when the panel has left the screen
uniform float u_seed;
uniform vec3 u_c[5];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.03 + .17; a *= .5; }
  return v;
}
vec3 ramp(float t){
  t = clamp(t, 0., 1.) * 4.;
  vec3 c = mix(u_c[0], u_c[1], smoothstep(0., 1., t));
  c = mix(c, u_c[2], smoothstep(1., 2., t));
  c = mix(c, u_c[3], smoothstep(2., 3., t));
  return mix(c, u_c[4], smoothstep(3., 4., t));
}
vec3 saturate(vec3 c, float k){ float l = dot(c, vec3(.299, .587, .114)); return mix(vec3(l), c, k); }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y) * 1.15;
  vec2 m = u_m - .5;
  float t = u_t * .045;

  vec2 q = vec2(fbm(p + u_seed + vec2(t, -t * .6)), fbm(p + u_seed * 1.7 + 5.2 - vec2(t * .8, t * .3)));
  vec2 r = vec2(fbm(p * 1.4 + 2.2 * q + m * .9 + t), fbm(p * 1.4 + 2.2 * q + 3.1 - m * .9));

  // bands across the diagonal, as on microsoft.ai: deep through the middle where the type sits, the warm
  // pigments either side, deep again toward the corners. The pointer turns the bands toward it.
  vec2 d = normalize(vec2(.62 + m.x * .5, .78 - m.y * .3));
  vec2 bd = vec2(-d.y, d.x);
  float along = dot(uv - .5, d);
  // a noise stretched along the bands drags their edges into brush strokes
  float bw = fbm(vec2(dot(p, bd) * .8, dot(p, d) * 4.4) + u_seed * 1.3 + vec2(t * .7, 0.));
  float k = .5 + .5 * cos(6.2832 * (along * 1.05 + (r.x - .5) * .5 + (bw - .5) * .42) + u_s * 1.1);

  // the text area, centre and a little high, settles toward the deep end so cream type stays legible
  vec2 c = (uv - vec2(.5, .54)) * vec2(asp * .55, 1.);
  float calm = exp(-dot(c, c) * 3.);
  k = mix(k, .86, calm * .62);
  vec3 col = ramp(k);

  // bristles: fine streaks along the bands, warped by the same field
  float s = noise(vec2(dot(p, bd) * 2.2, dot(p, d) * 30.) + r * 3.);
  float s2 = noise(vec2(dot(p, bd) * 5., dot(p, d) * 70.) + q * 2.);
  col *= .93 + .1 * s + .05 * s2;

  // the pointer brightens what is under it; moving side to side warms or cools the whole panel
  float glow = exp(-dot((uv - u_m) * vec2(asp, 1.), (uv - u_m) * vec2(asp, 1.)) * 5.);
  col = mix(col, col * 1.06 + .035, glow * .55);
  col = saturate(col, 1.02 + m.x * .22 - u_s * .25);
  col *= 1. - u_s * .12;

  float g = hash(gl_FragCoord.xy + fract(u_t * 7.13) * 91.) - .5;
  col += g * .045;
  gl_FragColor = vec4(col, 1.);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

interface Panel {
  el: HTMLElement;
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  u: Record<string, WebGLUniformLocation | null>;
  m: [number, number];
  target: [number, number];
  s: number;
  visible: boolean;
  t0: number;
}

const still = matchMedia('(prefers-reduced-motion: reduce)');

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
  return sh;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function program(gl: WebGLRenderingContext): Uniforms | undefined {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return Object.fromEntries(['u_res', 'u_t', 'u_m', 'u_s', 'u_seed', 'u_c'].map((n) => [n, gl.getUniformLocation(prog, n)]));
}

function mount(el: HTMLElement): Panel | undefined {
  const colours = JSON.parse(el.dataset.paint || '[]') as string[];
  if (colours.length !== 5) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'paint__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return;
  try {
    const u = program(gl);
    if (!u) return;
    gl.uniform3fv(u.u_c, new Float32Array(colours.flatMap(hex)));
    gl.uniform1f(u.u_seed, Number(el.dataset.paintSeed ?? 3.7));
    el.prepend(canvas);
    const panel: Panel = { el, gl, canvas, u, m: [0.35, 0.45], target: [0.35, 0.45], s: 0, visible: true, t0: performance.now() };
    // a seed shifts the starting time too, so two panels on a page never move in step
    panel.t0 -= Number(el.dataset.paintSeed ?? 0) * 9000;
    return panel;
  } catch {
    return;
  }
}

/** The cards of posts without a picture: one shared context paints a still frame of the same light for each
    tile as it nears the screen and copies it in, so a page of tiles costs one WebGL context, not one each. */
export function paintTiles() {
  const tiles = [...document.querySelectorAll<HTMLElement>('[data-tile]')];
  if (!tiles.length) return;
  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return;
  let u: Uniforms | undefined;
  try {
    u = program(gl);
  } catch {
    return;
  }
  if (!u) return;
  const uu = u;
  const paint = (el: HTMLElement) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(el.clientWidth * dpr));
    const h = Math.max(1, Math.round(el.clientHeight * dpr));
    const seed = Number(el.dataset.tileSeed ?? 1);
    glc.width = w;
    glc.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform3fv(uu.u_c, new Float32Array((JSON.parse(el.dataset.tile!) as string[]).flatMap(hex)));
    gl.uniform1f(uu.u_seed, seed);
    gl.uniform2f(uu.u_res, w, h);
    gl.uniform1f(uu.u_t, 20 + seed * 7);
    gl.uniform2f(uu.u_m, 0.5, 0.5);
    gl.uniform1f(uu.u_s, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    let out = el.querySelector<HTMLCanvasElement>(':scope > canvas');
    if (!out) {
      out = document.createElement('canvas');
      out.setAttribute('aria-hidden', 'true');
      el.prepend(out);
    }
    out.width = w;
    out.height = h;
    out.getContext('2d')?.drawImage(glc, 0, 0);
    el.classList.add('is-painted');
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        paint(e.target as HTMLElement);
      }
    },
    { rootMargin: '400px 0px' },
  );
  tiles.forEach((t) => io.observe(t));
  let wait = 0;
  addEventListener('resize', () => {
    clearTimeout(wait);
    wait = window.setTimeout(() => tiles.filter((t) => t.classList.contains('is-painted')).forEach(paint), 250);
  });
}

function size(p: Panel) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(p.el.clientWidth * dpr));
  const h = Math.max(1, Math.round(p.el.clientHeight * dpr));
  if (p.canvas.width !== w || p.canvas.height !== h) {
    p.canvas.width = w;
    p.canvas.height = h;
    p.gl.viewport(0, 0, w, h);
  }
}

function draw(p: Panel, now: number) {
  size(p);
  const { gl, u } = p;
  gl.uniform2f(u.u_res, p.canvas.width, p.canvas.height);
  gl.uniform1f(u.u_t, still.matches ? 12 : (now - p.t0) / 1000);
  gl.uniform2f(u.u_m, p.m[0], p.m[1]);
  gl.uniform1f(u.u_s, p.s);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  p.el.classList.add('is-painted');
}

export function paintAll() {
  const panels = [...document.querySelectorAll<HTMLElement>('[data-paint]')].map(mount).filter(Boolean) as Panel[];
  if (!panels.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const p = panels.find((q) => q.el === e.target);
      if (p) p.visible = e.isIntersecting;
    }
  });
  for (const p of panels) io.observe(p.el);

  const scroll = () => {
    for (const p of panels) {
      const r = p.el.getBoundingClientRect();
      p.s = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    }
  };
  addEventListener('scroll', scroll, { passive: true });
  scroll();

  addEventListener(
    'pointermove',
    (e) => {
      for (const p of panels) {
        const r = p.el.getBoundingClientRect();
        p.target = [
          Math.min(1.2, Math.max(-0.2, (e.clientX - r.left) / r.width)),
          Math.min(1.2, Math.max(-0.2, 1 - (e.clientY - r.top) / r.height)),
        ];
      }
    },
    { passive: true },
  );

  if (still.matches) {
    const once = () => panels.forEach((p) => draw(p, 0));
    once();
    addEventListener('resize', once);
    return;
  }

  let last = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 1000 / 45) return;
    last = now;
    for (const p of panels) {
      if (!p.visible) continue;
      p.m[0] += (p.target[0] - p.m[0]) * 0.05;
      p.m[1] += (p.target[1] - p.m[1]) * 0.05;
      draw(p, now);
    }
  };
  requestAnimationFrame(frame);
}
