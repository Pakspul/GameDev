#!/usr/bin/env node
// Zero-dependency dev server for playing the games in a browser — on your computer
// AND on your phone (same Wi-Fi network). Caching is disabled so a refresh always
// shows your latest edit.
//
//   npm run dev              serves the source folders (edit → refresh)
//   npm run dev -- --dist    serves dist/ (exactly what goes into the Android app)
//   PORT=3000 npm run dev    use another port
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, normalize, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8",
};
// Never serve tooling or native folders, only the web game.
const BLOCKED = ["node_modules", ".git", "android", "ios", "scripts", "tests"];

/** Starts the static server; resolves with the http.Server once listening. Also used by the smoke test. */
export function startServer({ dir = ROOT, port = 8080, host = "0.0.0.0" } = {}) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(dir, path));
      if (!file.startsWith(dir + sep)) throw 403; // no escaping the served folder
      if (dir === ROOT && BLOCKED.includes(file.slice(dir.length + 1).split(sep)[0])) throw 404;
      if ((await stat(file)).isDirectory()) return void res.writeHead(301, { Location: path + "/" }).end();
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch (e) {
      const code = e === 403 ? 403 : 404;
      res.writeHead(code, { "Content-Type": "text/plain" }).end(code === 403 ? "Forbidden" : "Not found");
    }
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

// Run directly (npm run dev): start on PORT and print the URLs to open.
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const DIR = process.argv.includes("--dist") ? join(ROOT, "dist") : ROOT;
  const PORT = Number(process.env.PORT) || 8080;
  await startServer({ dir: DIR, port: PORT });
  const lan = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`\nServing ${DIR === ROOT ? "source" : "dist/"} — Ctrl+C to stop\n`);
  console.log(`  On this computer:  http://localhost:${PORT}/`);
  for (const ip of lan) console.log(`  On your phone:     http://${ip}:${PORT}/   (same Wi-Fi)`);
  console.log("");
}
