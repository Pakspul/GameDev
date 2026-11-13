// Symbol art: every symbol is a small inline SVG made in code, so the game needs no image files.
// A machine config names an art key per symbol ("art": "gem-red"); installArt() adds the ones in use
// to the page as <symbol> elements that cells reference with <use>.

const FONT = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="900"';
const grad = (id, c1, c2) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
const rgrad = (id, c1, c2) => `<radialGradient id="${id}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;

function starPoints(cx, cy, R, r, n, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180, rad = i % 2 ? r : R;
    pts.push((cx + Math.cos(a) * rad).toFixed(1) + "," + (cy + Math.sin(a) * rad).toFixed(1));
  }
  return pts.join(" ");
}

const tile = (id, text, c1, c2, fs = 46) =>
  `<defs>${grad(id, c1, c2)}</defs><rect x="8" y="8" width="84" height="84" rx="20" fill="url(#${id})" stroke="rgba(255,255,255,.6)" stroke-width="2.5"/>` +
  `<rect x="14" y="12" width="72" height="28" rx="13" fill="rgba(255,255,255,.2)"/>` +
  `<text x="50" y="${50 + fs * 0.36}" text-anchor="middle" ${FONT} font-size="${fs}" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width="2" paint-order="stroke">${text}</text>`;

const gem = (id, a, b, c) =>
  `<defs>${grad(id, a, b)}</defs><polygon points="20,36 34,12 66,12 80,36 50,90" fill="url(#${id})" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>` +
  `<polygon points="20,36 80,36 50,90" fill="rgba(0,0,0,.18)"/><polygon points="34,12 42,36 20,36" fill="rgba(255,255,255,.35)"/><polygon points="66,12 58,36 80,36" fill="rgba(255,255,255,.12)"/>` +
  `<polyline points="34,12 42,36 50,90 58,36 66,12" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/>`;

const burst = (id, c1, c2, label, fs) =>
  `<defs>${rgrad(id, c1, c2)}</defs><polygon points="${starPoints(50, 50, 47, 33, 12)}" fill="url(#${id})" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>` +
  `<circle cx="50" cy="50" r="27" fill="rgba(0,0,0,.28)"/><text x="50" y="${50 + fs * 0.36}" text-anchor="middle" ${FONT} font-size="${fs}" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="2" paint-order="stroke">${label}</text>`;

/** Two strokes (wide and faint, thin and bright) read as a neon glow without any filter. */
const neon = (shape, color) => `<rect x="6" y="6" width="88" height="88" rx="18" fill="rgba(255,255,255,.04)" stroke="${color}" stroke-opacity=".25" stroke-width="2"/>` +
  `<g fill="none" stroke-linejoin="round" stroke-linecap="round"><g stroke="${color}" stroke-opacity=".28" stroke-width="11">${shape}</g><g stroke="${color}" stroke-width="5">${shape}</g><g stroke="#fff" stroke-opacity=".85" stroke-width="1.6">${shape}</g></g>`;

export const ART = {
  blank: () => `<rect x="10" y="10" width="80" height="80" rx="18" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>`,
  // ---- Crystal Fortune ----
  ten: () => tile("a-ten", "10", "#33d6c4", "#0f7f9c", 42),
  jack: () => tile("a-jack", "J", "#5b9bff", "#2a46b8"),
  queen: () => tile("a-queen", "Q", "#b07cff", "#5c2cb8"),
  king: () => tile("a-king", "K", "#ff6fb7", "#b3226f"),
  ace: () => tile("a-ace", "A", "#ffd35a", "#d9831a"),
  "gem-green": () => gem("a-gg", "#5dffb0", "#0a9b5a", "#bfffe0"),
  "gem-blue": () => gem("a-gb", "#6fd0ff", "#1457d6", "#d2eeff"),
  "gem-red": () => gem("a-gr", "#ff7a8a", "#b0102e", "#ffd2d8"),
  crown: () => `<defs>${grad("a-cr", "#ffe27a", "#d98a12")}</defs><polygon points="12,76 17,32 36,54 50,24 64,54 83,32 88,76" fill="url(#a-cr)" stroke="#fff3c4" stroke-width="3" stroke-linejoin="round"/>` +
    `<rect x="12" y="76" width="76" height="12" rx="5" fill="url(#a-cr)" stroke="#fff3c4" stroke-width="2.5"/><circle cx="17" cy="32" r="5" fill="#ff5a7a"/><circle cx="50" cy="24" r="6" fill="#5ad7ff"/><circle cx="83" cy="32" r="5" fill="#7dffb0"/><circle cx="50" cy="82" r="4" fill="#ff5a7a"/>`,
  wild: () => burst("a-w", "#ff7ae8", "#6a1fd0", "WILD", 21),
  "wild-x2": () => burst("a-w2", "#7ae8ff", "#1f5fd0", "×2", 30),
  "wild-x3": () => burst("a-w3", "#ffd37a", "#d0481f", "×3", 30),
  scatter: () => `<defs>${rgrad("a-sc", "#fff7c2", "#ff9d1a")}</defs><circle cx="50" cy="50" r="40" fill="url(#a-sc)" stroke="#fff" stroke-width="3"/><circle cx="50" cy="50" r="33" fill="none" stroke="rgba(120,50,0,.35)" stroke-width="2" stroke-dasharray="3 4"/>` +
    `<polygon points="${starPoints(50, 52, 26, 11, 5)}" fill="#fff" stroke="#c4561a" stroke-width="2.5" stroke-linejoin="round"/>`,
  coin: () => `<defs>${rgrad("a-co", "#fff2a6", "#e09a14")}</defs><circle cx="50" cy="50" r="40" fill="url(#a-co)" stroke="#fff3c4" stroke-width="3"/><circle cx="50" cy="50" r="31" fill="none" stroke="rgba(150,80,0,.5)" stroke-width="3"/><polygon points="${starPoints(50, 51, 16, 7, 5)}" fill="rgba(150,80,0,.45)"/>`,
  lantern: () => `<defs>${grad("a-la", "#ff6a5a", "#b3121e")}</defs><rect x="44" y="6" width="12" height="12" rx="3" fill="#ffd35a"/><rect x="26" y="16" width="48" height="8" rx="4" fill="#ffd35a"/>` +
    `<ellipse cx="50" cy="52" rx="30" ry="30" fill="url(#a-la)" stroke="#ffe3a0" stroke-width="3"/><path d="M40 24c-10 18-10 36 0 56M60 24c10 18 10 36 0 56M50 22v60" stroke="rgba(255,220,140,.6)" stroke-width="2" fill="none"/>` +
    `<rect x="26" y="78" width="48" height="8" rx="4" fill="#ffd35a"/><path d="M50 86v10M44 96h12" stroke="#ffd35a" stroke-width="3"/>`,
  // ---- Neon Tumble ----
  "neon-circle": () => neon(`<circle cx="50" cy="50" r="27"/>`, "#3df5ff"),
  "neon-triangle": () => neon(`<polygon points="50,20 80,74 20,74"/>`, "#ff5fa8"),
  "neon-square": () => neon(`<rect x="26" y="26" width="48" height="48" rx="6"/>`, "#b6ff3d"),
  "neon-hex": () => neon(`<polygon points="50,20 76,35 76,65 50,80 24,65 24,35"/>`, "#ffa53d"),
  "neon-ring": () => neon(`<circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="14"/>`, "#b07cff"),
  "neon-bolt": () => neon(`<polygon points="56,14 28,54 46,54 40,86 72,44 54,44"/>`, "#ffe53d"),
  "neon-heart": () => neon(`<path d="M50 80C22 60 20 38 33 29c8-5 15-2 17 6 2-8 9-11 17-6 13 9 11 31-17 51z"/>`, "#ff4d6d"),
  "neon-moon": () => neon(`<path d="M62 20a32 32 0 100 60 26 26 0 01-34-30 26 26 0 0134-30z"/>`, "#7df0ff"),
  "neon-star": () => neon(`<polygon points="${starPoints(50, 53, 33, 14, 5)}"/>`, "#ffd23d"),
  "neon-diamond": () => neon(`<polygon points="50,14 82,44 50,86 18,44"/><path d="M18 44h64M50 14L38 44l12 42 12-42z"/>`, "#ff7df0"),
  "neon-wild": () => `<defs>${rgrad("a-nw", "#ff7ae8", "#3d1fd0")}</defs><rect x="6" y="6" width="88" height="88" rx="18" fill="url(#a-nw)" stroke="#fff" stroke-width="2.5"/>` +
    `<polygon points="${starPoints(50, 50, 40, 28, 8)}" fill="rgba(255,255,255,.14)"/><text x="50" y="62" text-anchor="middle" ${FONT} font-size="40" fill="#fff" stroke="#ff2fb4" stroke-width="3" paint-order="stroke">WILD</text>`,
  "neon-scatter": () => neon(`<ellipse cx="50" cy="50" rx="34" ry="14" transform="rotate(30 50 50)"/><ellipse cx="50" cy="50" rx="34" ry="14" transform="rotate(-30 50 50)"/><polygon points="${starPoints(50, 51, 15, 6, 5)}"/>`, "#3dffb0"),
  "neon-bonus": () => neon(`<rect x="24" y="38" width="52" height="40" rx="4"/><rect x="20" y="28" width="60" height="12" rx="3"/><path d="M50 28v50M50 28c-4-12-18-10-14-2M50 28c4-12 18-10 14-2"/>`, "#ff9d3d"),
  "neon-collect": () => neon(`<rect x="30" y="24" width="40" height="58" rx="7"/><rect x="42" y="16" width="16" height="8" rx="2"/><path d="M52 36l-8 16h10l-6 16"/>`, "#3df5c8"),
};

/** Add the given art keys to the page so cells can reference them. */
export function installArt(keys, root = document.getElementById("sprite-defs")) {
  const have = new Set(Array.from(root.children).map((c) => c.id));
  for (const key of new Set(["blank", "coin", ...keys])) {
    if (have.has("sym-" + key)) continue;
    const make = ART[key];
    if (!make) throw new Error("No art for symbol key " + key);
    const sym = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
    sym.id = "sym-" + key;
    sym.setAttribute("viewBox", "0 0 100 100");
    sym.innerHTML = make();
    root.append(sym);
  }
}
