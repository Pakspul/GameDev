// Number formatting (WIN-04): locale aware, with compact amounts for narrow fields.

/** The locale numbers are shown in: the device's, as the specification asks. */
export function deviceLocale() {
  try {
    if (typeof navigator !== "undefined") return (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  } catch (e) { /* ignore */ }
  return "en";
}

const cache = new Map();
function nf(locale, opts) {
  const key = locale + JSON.stringify(opts || {});
  let f = cache.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, opts); cache.set(key, f); }
  return f;
}

/** 1234567 -> "1,234,567" (en) / "1.234.567" (nl) */
export function formatCoins(n, locale = deviceLocale()) {
  return nf(locale, { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/** Amounts from 1,000,000 up are abbreviated for compact fields: 1250000 -> "1.25M"; smaller ones are shown in full. */
export function formatCompact(n, locale = deviceLocale()) {
  n = Math.floor(n);
  const f = nf(locale, { maximumFractionDigits: 2 });
  if (n >= 1e9) return f.format(Math.floor(n / 1e7) / 100) + "B";
  if (n >= 1e6) return f.format(Math.floor(n / 1e4) / 100) + "M";
  return formatCoins(n, locale);
}

/** "12:05" style duration for the session reminder and timers. */
export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
