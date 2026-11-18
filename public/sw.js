// sw.js: the service worker. It keeps a copy of the app on the phone,
// so the app opens instantly and works with no internet.
// It lives in public/, so Vite copies it as-is next to index.html in the built site.
//
// Updates: the app always opens from the saved copy, and meanwhile the worker
// quietly downloads the newest version. The open page also asks for a check whenever
// you come back to it (ui/update.js); when a newer version has been saved, the page
// shows "New version ready · Reload".

const APP_CACHE = "dice-n-roll-app";

// The app's own address (…/dice-n-roll/): every saved file is resolved against it
const ROOT = self.registration.scope;
const EXTRA_FILES = [
  "manifest.webmanifest",
  "favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "fonts/inter-latin.woff2",
  "fonts/inter-latin-ext.woff2",
  "fonts/bricolage-latin.woff2",
  "fonts/bricolage-latin-ext.woff2",
];

// Install: save the whole app right away, so it works offline after the very first visit
self.addEventListener("install", (event) => {
  event.waitUntil(saveApp().then(() => self.skipWaiting()));
});

// Activate: start controlling the open page immediately, not only after a reload.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.delete("dice-n-roll-fonts")]));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Opening the app: answer from the saved copy, and look for a new version in the background
  if (request.mode === "navigate" && request.url.startsWith(ROOT)) {
    event.respondWith(openApp());
    event.waitUntil(saveApp().catch(() => {})); // offline or server down: just keep the old copy
    return;
  }

    // The app's own files: saved copy first, internet only the first time
  if (request.url.startsWith(ROOT)) {
    event.respondWith(savedFirst(request, APP_CACHE));
  }
});

// The page asks "check": look for a new version now, then answer with the files of the
// saved copy. The page compares them with its own file to see if it's out of date.
self.addEventListener("message", (event) => {
  if (event.data !== "check") return;
  event.waitUntil(
    saveApp()
      .catch(() => {}) // offline: answer with what's saved
      .then(savedFiles)
      .then((files) => event.source.postMessage({ type: "saved", files })),
  );
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
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function savedFiles() {
  const cache = await caches.open(APP_CACHE);
  const page = await cache.match(ROOT);
  return page ? filesOf(await page.text()) : [];
}

// One download at a time: opening the app and a check from the page can come together,
// and two downloads at once could delete each other's files
let saving = Promise.resolve();
function saveApp() {
  saving = saving.catch(() => {}).then(downloadApp);
  return saving;
}

// Downloads the newest index.html and every file it points to.
// Vite gives built files a new name whenever their content changes
// (assets/index-3fa9c1.js), so a new name means a new version.
async function downloadApp() {
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