// sw.js: the service worker. It keeps a copy of the app on the phone,
// so the app opens instantly and works with no internet.
// It lives in public/, so Vite copies it as-is next to index.html in the built site.
//
// Updates are silent: the app always opens from the saved copy, and meanwhile
// the worker quietly downloads the newest version. The next time you open the
// app, that new version is the one you get.

const APP_CACHE = "dice-n-roll-app";
const FONT_CACHE = "dice-n-roll-fonts";

// The app's own address (…/dice-n-roll/): every saved file is resolved against it
const ROOT = self.registration.scope;
const EXTRA_FILES = ["manifest.webmanifest", "favicon.svg", "icons/icon-192.png", "icons/icon-512.png"];

// Install: save the whole app right away, so it works offline after the very first visit
self.addEventListener("install", (event) => {
  event.waitUntil(saveApp().then(() => self.skipWaiting()));
});

// Activate: start controlling the open page immediately, not only after a reload
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Opening the app: answer from the saved copy, and look for a new version in the background
  if (request.mode === "navigate" && request.url.startsWith(ROOT)) {
    event.respondWith(openApp());
    event.waitUntil(saveApp().catch(() => {})); // offline or server down: just keep the old copy
    return;
  }

  // The app's files and the Google fonts: saved copy first, internet only the first time
  if (request.url.startsWith(ROOT)) {
    event.respondWith(savedFirst(request, APP_CACHE));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(savedFirst(request, FONT_CACHE));
  }
});

async function openApp() {
  const cache = await caches.open(APP_CACHE);
  return (await cache.match(ROOT)) ?? fetch(ROOT);
}

async function savedFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  // "opaque" = a file from another site (the fonts); it can be saved but not inspected
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

// Downloads the newest index.html and every file it points to.
// Vite gives built files a new name whenever their content changes
// (assets/index-3fa9c1.js), so a new name means a new version.
async function saveApp() {
  const response = await fetch(ROOT, { cache: "no-cache" }); // skip the browser's own 10-minute cache
  if (!response.ok) throw new Error(`Could not load the app: ${response.status}`);
  const files = filesOf(await response.clone().text());

  const cache = await caches.open(APP_CACHE);
  const previous = await cache.match(ROOT);
  const previousFiles = previous ? filesOf(await previous.text()) : [];

  // Files first, page last: the saved page must never point to a file that isn't saved
  for (const file of files) {
    if (!(await cache.match(file))) await cache.add(file);
  }
  await cache.put(ROOT, response);

  // Remove files no longer used. The previous version's files stay one more round:
  // the page opened a moment ago may still be loading them.
  const keep = new Set([ROOT, ...files, ...previousFiles]);
  for (const request of await cache.keys()) {
    if (!keep.has(request.url)) await cache.delete(request);
  }
}

// Every src="…" and href="…" in the page that points into assets/, plus the extra files
function filesOf(html) {
  const assets = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => new URL(match[1], ROOT).href);
  return [...assets, ...EXTRA_FILES.map((file) => new URL(file, ROOT).href)];
}