// Small DOM helpers shared by every screen: element builder, timing, easing and icons.

/** Global animation speed multiplier (1 in normal play; development builds can raise it). */
export const timing = { speed: 1 };

const SVG_TAGS = new Set(["svg", "use", "path", "g", "rect", "circle", "polygon", "polyline", "ellipse", "line", "text", "defs"]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** h("div", { class: "x", onclick: fn, dataset: {a: 1}, style: {color: "red"} }, child, "text") */
export function h(tag, props, ...kids) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mod = (a, n) => ((a % n) + n) % n;

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

/** A promise that resolves after `ms` of game time (shortened when the animation speed is raised). */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms / timing.speed));
}

/** Run fn(t in 0..1) every frame for `ms`; the returned promise has .cancel(finish) to stop early. */
export function tween(ms, fn, easing = ease.linear) {
  let cancelled = false, finishNow = false, rafId = 0, resolveFn;
  const p = new Promise((resolve) => {
    resolveFn = resolve;
    const start = performance.now();
    const step = (now) => {
      if (cancelled) return resolve(false);
      const t = clamp((now - start) * timing.speed / ms, 0, 1);
      fn(easing(t));
      if (t >= 1 || finishNow) { if (finishNow && t < 1) fn(easing(1)); return resolve(true); }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  });
  p.cancel = (finish = false) => { if (finish) { finishNow = true; } else { cancelled = true; cancelAnimationFrame(rafId); resolveFn(false); } };
  return p;
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---- icons (inline SVG, no files) -----------------------------------------------------------------
const ICONS = {
  back: "M15 5l-7 7 7 7",
  menu: "M4 7h16M4 12h16M4 17h16",
  gear: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L8.5 19 8 21l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z",
  info: "M12 11v6M12 7.5v.5M12 3a9 9 0 100 18 9 9 0 000-18z",
  sound: "M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12",
  mute: "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6",
  turbo: "M13 2L5 14h6l-1 8 8-12h-6z",
  auto: "M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M18 3v4h-4M6 21v-4h4",
  stop: "M7 7h10v10H7z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  spin: "M20 12a8 8 0 11-2.6-5.9M20 4v5h-5",
  trophy: "M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a3 3 0 003 3M16 6h4v1a3 3 0 01-3 3M12 13v4M8 20h8M9 17h6",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1-3-5-3-5-1s3 1 5 1zM12 7c1-3 5-3 5-1s-3 1-5 1z",
  close: "M6 6l12 12M18 6L6 18",
  lock: "M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z",
  play: "M8 5v14l11-7z",
  pause: "M8 5v14M16 5v14",
};

export function icon(name, size = 22) {
  const svg = h("svg", { viewBox: "0 0 24 24", width: size, height: size, class: "icon", "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" });
  svg.append(h("path", { d: ICONS[name] || ICONS.info }));
  return svg;
}

/** A <use> reference to a symbol of the art sprite. */
export function symbolSvg(artId, cls = "sym") {
  const svg = h("svg", { viewBox: "0 0 100 100", class: cls, "aria-hidden": "true" });
  const use = h("use", { href: "#sym-" + artId });
  svg.append(use);
  return svg;
}
